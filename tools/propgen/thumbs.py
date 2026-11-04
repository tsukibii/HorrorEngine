"""Every recipe's picture kept in the project (docs/PROPGEN.md §25; the user, 2026-11-04: "pre-render and save
thumbnails for each prop, in a clever way so we can preview what custom stickers would look like on props like
cans"), in Content/Studio/Props/thumbs/:

    <name>.webp         the picture, 400 x 300 (the preview at half its size)
    <name>.st.webp      its sticker passes, lossless (stage.py: the texture's point each pixel sees, the light a white
                        matt surface gets there, a clear coat's gloss), pixel for pixel with the picture
    <name>.ground.webp  the picture with its own picture slots empty, where it has some (a swapped logo hides the old)
    <name>.bare.webp    a variant: a chair without its cushions
    <name>.json         the recipe it was made from, its materials in the passes' order, its parts (islands), its
                        picture slots, its size

The page (tools/propgen/serve.py) shows them on the cards before a prop is made here and lays your pictures onto them
(page/sticker.js). Plain Python with Pillow; what isn't made (or was made from another recipe) is made first by
tools/propgen.py make, each in a Blender of its own, `--jobs` at once.

    python tools/propgen.py thumbs [names...] [--make] [--bare] [--jobs 2] [--tex 1024]
    python tools/propgen.py thumbs --check          THUMBS: every kept picture well formed, what's missing or stale
"""
import datetime
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from propgen import recipes

ROOT = Path(__file__).resolve().parents[2]
THUMBS = Path(os.environ.get("PROPS_THUMBS") or (ROOT / "Content" / "Studio" / "Props" / "thumbs"))
BARE = Path(recipes.OUT) / "_bare"
SIZE = (400, 300)


def bare_spec(sp):
    """A recipe as it shapes the prop: what only the tools set (the texture's size) left out (serve.py's _bare)."""
    return {k: v for k, v in (sp or {}).items() if k not in ("tex",) and not k.startswith("_")}


def variants_of(spec):
    """The other pictures a recipe keeps: (key, what it is, the --set that makes it). A chair with its cushions on
    keeps one without them (the user: "make sure pillows are toggleable so we can gen versions without pillow")."""
    out = []
    if spec.get("family") == "chair":
        cu = spec.get("cushion")
        on = cu is True or (isinstance(cu, dict) and cu.get("on", True) is not False)
        if on:
            out.append(("bare", "without its cushions", ["cushion.on=false"]))
    return out


def _made(name, out):
    d = Path(out) / name
    try:
        return json.loads((d / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


PASSES = 2           # stage.PASSES: passes older than these are made again


def up_to_date(name, spec, out=recipes.OUT):
    """Made from this recipe, with its sticker passes as they're made now."""
    m = _made(name, out)
    d = Path(out) / name
    if not m or bare_spec(m.get("spec")) != bare_spec(spec) or not (d / f"{name}_st.png").exists() or not (d / f"{name}_preview.png").exists():
        return False
    try:
        return json.loads((d / f"{name}_st.json").read_text(encoding="utf-8")).get("v", 1) >= PASSES
    except (OSError, ValueError):
        return False


def save(name, out=recipes.OUT, dst=THUMBS, variants=None):
    """The made prop's picture, passes and ground into the project, with what the page needs to lay a picture."""
    from PIL import Image
    d = Path(out) / name
    meta = _made(name, out)
    if not meta:
        raise SystemExit(f"{name}: not made")
    dst.mkdir(parents=True, exist_ok=True)

    def half(p):
        im = Image.open(p).convert("RGB")
        return im.reduce(2) if im.size == (SIZE[0] * 2, SIZE[1] * 2) else im.resize(SIZE)
    half(d / f"{name}_preview.png").save(dst / f"{name}.webp", quality=86, method=6)
    st = d / f"{name}_st.png"
    sj = json.loads((d / f"{name}_st.json").read_text(encoding="utf-8")) if (d / f"{name}_st.json").exists() else {}
    if st.exists():
        Image.open(st).convert("RGB").save(dst / f"{name}.st.webp", lossless=True, quality=100, method=6)
    g = d / f"{name}_st_ground.png"
    if g.exists() and sj.get("ground"):
        Image.open(g).convert("RGB").save(dst / f"{name}.ground.webp", quality=86, method=6)
    elif (dst / f"{name}.ground.webp").exists():
        (dst / f"{name}.ground.webp").unlink()
    # the textures' pixels as the recipe makes them (the pictures may have been made smaller): a pattern's tiles on the
    # page are sized by them, as Make sizes them
    book = recipes.load()
    want = recipes.resolve(book, name).get("tex") if name in book else None
    got = (meta.get("spec") or {}).get("tex")
    k = float(want) / float(got) if want and got else 1.0
    rec = {"name": name, "family": meta.get("family"), "spec": bare_spec(meta.get("spec")), "made": datetime.date.today().isoformat(),
           "size_m": meta.get("size_m"), "tris": meta.get("tris"), "mats": sj.get("mats") or [],
           "px": {m: int(round(v.get("px") * k)) for m, v in (meta.get("materials") or {}).items()},
           "islands": {n: {"mat": i["mat"], "rect": i["rect"], "mm": i["mm"], "wrap": bool(i.get("wrap"))} for n, i in (meta.get("islands") or {}).items()},
           "slots": [{k: s[k] for k in ("id", "island", "name", "kind", "about", "rot", "box") if k in s} for s in (meta.get("slots") or [])]}
    old = {}
    if (dst / f"{name}.json").exists():
        try:
            old = json.loads((dst / f"{name}.json").read_text(encoding="utf-8")).get("variants") or {}
        except ValueError:
            old = {}
    vs = dict(old)
    for key, label, _sets in variants_of(meta.get("spec") or {}):
        vd = BARE / f"{name}__{key}"
        pv = vd / f"{name}__{key}_preview.png"
        if variants is not None and key in variants and pv.exists():
            half(pv).save(dst / f"{name}.{key}.webp", quality=86, method=6)
        if (dst / f"{name}.{key}.webp").exists():
            vs[key] = {"label": label, "file": f"{name}.{key}.webp"}
    for key in list(vs):
        if key not in {k for k, _l, _s in variants_of(meta.get("spec") or {})}:
            vs.pop(key)
            try:
                (dst / f"{name}.{key}.webp").unlink()
            except OSError:
                pass
    if vs:
        rec["variants"] = vs
    (dst / f"{name}.json").write_text(json.dumps(rec, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return rec


def _run_makes(jobs, opts, log=print):
    """Each job (argv for tools/propgen.py) in a Blender of its own, opts["jobs"] at once; the names that failed."""
    slots, pending, failed = int(opts["jobs"]), list(jobs), []
    running = []
    py = sys.executable
    tool = str(ROOT / "tools" / "propgen.py")
    logdir = Path(recipes.OUT) / "_thumbs_log"
    logdir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    total = len(pending)
    while pending or running:
        while pending and len(running) < slots:
            label, argv = pending.pop(0)
            fh = open(logdir / f"{label}.log", "w", encoding="utf-8")
            p = subprocess.Popen([py, tool] + argv, stdout=fh, stderr=subprocess.STDOUT, cwd=str(ROOT))
            running.append((label, p, fh))
        time.sleep(1.0)
        for item in list(running):
            label, p, fh = item
            if p.poll() is None:
                continue
            fh.close()
            running.remove(item)
            done = total - len(pending) - len(running)
            ok = p.returncode == 0
            if not ok:
                failed.append(label)
            log(f"  [{done}/{total} {int(time.time() - t0)}s] {label}: {'made' if ok else 'FAILED (Saved/Props/_thumbs_log/' + label + '.log)'}")
    return failed


def main(argv):
    try:
        sys.stdout.reconfigure(line_buffering=True)          # its progress as it goes, into a log too
    except AttributeError:
        pass
    args = list(argv)
    flag = lambda f: (args.remove(f) or True) if f in args else False  # noqa: E731
    make, bare, check = flag("--make"), flag("--bare"), flag("--check")
    opts = {"jobs": 2, "tex": 1024}
    for k in ("--jobs", "--tex"):
        if k in args:
            i = args.index(k)
            opts[k[2:]] = int(args[i + 1])
            del args[i:i + 2]
    book = recipes.load()
    names = args or list(book)
    unknown = [n for n in names if n not in book]
    if unknown:
        sys.exit(f"not recipes: {', '.join(unknown)}")
    if check:
        return run_check(book, names)
    specs = {n: recipes.resolve(book, n) for n in names}
    if make:
        todo = [n for n in names if not up_to_date(n, specs[n])]
        jobs = [(n, ["make", n, "--tex", str(opts["tex"]), "--formats", "glb"]) for n in todo]
        if bare:
            for n in names:
                for key, _label, sets in variants_of(specs[n]):
                    vn = f"{n}__{key}"
                    m = _made(vn, BARE)
                    want = bare_spec(recipes.resolve(book, n, sets))
                    if not m or bare_spec(m.get("spec")) != want:
                        jobs.append((vn, ["make", n, "--as", vn, "--out", str(BARE), "--tex", str(opts["tex"]), "--formats", "glb"] +
                                     [x for s in sets for x in ("--set", s)]))
        if jobs:
            print(f"THUMBS making {len(jobs)} ({opts['jobs']} at once, textures {opts['tex']}): {', '.join(j[0] for j in jobs[:12])}"
                  f"{'…' if len(jobs) > 12 else ''}")
            failed = _run_makes(jobs, opts)
            if failed:
                print(f"  failed: {', '.join(failed)}")
    saved, missing, stale = [], [], []
    for n in names:
        if not _made(n, recipes.OUT):
            missing.append(n)
            continue
        if bare_spec(_made(n, recipes.OUT).get("spec")) != bare_spec(specs[n]):
            stale.append(n)
            continue
        save(n, variants={k for k, _l, _s in variants_of(specs[n])})
        saved.append(n)
    print(f"THUMBS saved {len(saved)} into {os.path.relpath(THUMBS, ROOT)}" + (f"; not made: {', '.join(missing)}" if missing else "")
          + (f"; made from another recipe (make them again): {', '.join(stale)}" if stale else ""))
    return 0


def run_check(book, names):
    """THUMBS: every kept picture well formed (its picture and passes the same size, the passes' materials within its
    list, its parts and slots on them), and what's missing or kept from another recipe said."""
    from PIL import Image
    import numpy as np
    bad, missing, stale, n_ok, n_st = [], [], [], 0, 0
    for n in names:
        j = THUMBS / f"{n}.json"
        if not j.exists() or not (THUMBS / f"{n}.webp").exists():
            missing.append(n)
            continue
        try:
            rec = json.loads(j.read_text(encoding="utf-8"))
            im = Image.open(THUMBS / f"{n}.webp")
            if im.size != SIZE:
                raise ValueError(f"picture {im.size}, not {SIZE}")
            stp = THUMBS / f"{n}.st.webp"
            if stp.exists():
                a = np.asarray(Image.open(stp).convert("RGB")).astype(np.int64)
                if a.shape != (SIZE[1], SIZE[0] * 2, 3):
                    raise ValueError(f"passes {a.shape[1]} x {a.shape[0]}, not {SIZE[0] * 2} x {SIZE[1]}")
                mid = a[:, SIZE[0]:, 0] >> 4
                if not (mid > 0).any():
                    raise ValueError("its passes see nothing of it")
                if int(mid.max()) > len(rec.get("mats") or []):
                    raise ValueError(f"its passes name material {int(mid.max())} of {len(rec.get('mats') or [])}")
                mats = set(rec.get("mats") or [])
                for iname, isl in (rec.get("islands") or {}).items():
                    if isl["mat"] not in mats:
                        raise ValueError(f"part {iname} on material {isl['mat']}, not in the passes")
                # every pixel's texture point on one of its material's parts: the passes and the parts agree
                L = a[:, :SIZE[0]]
                u = ((L[..., 0] << 4) | (L[..., 2] >> 4)) / 4095.0
                v = ((L[..., 1] << 4) | (L[..., 2] & 15)) / 4095.0
                seen = mid > 0
                on = np.zeros_like(seen)
                e = 0.6 / 4096
                for k, mname in enumerate(rec.get("mats") or []):
                    sel = mid == k + 1
                    for isl in (rec.get("islands") or {}).values():
                        if isl["mat"] == mname:
                            u0, v0, u1, v1 = isl["rect"]
                            on |= sel & (u >= u0 - e) & (u <= u1 + e) & (v >= v0 - e) & (v <= v1 + e)
                share = float(on.sum()) / max(1, int(seen.sum()))
                if share < 0.9:
                    raise ValueError(f"only {share:.0%} of its pixels on its parts: the passes and its parts disagree")
                for s in rec.get("slots") or []:
                    if s["island"] not in (rec.get("islands") or {}):
                        raise ValueError(f"slot {s['id']} on no part")
                n_st += 1
            for key, vd in (rec.get("variants") or {}).items():
                if not (THUMBS / vd["file"]).exists():
                    raise ValueError(f"variant {key}: {vd['file']} missing")
            if bare_spec(rec.get("spec")) != bare_spec(recipes.resolve(book, n)):
                stale.append(n)
            n_ok += 1
        except (OSError, ValueError, KeyError) as e:
            bad.append(f"{n}: {e}")
    for b in bad:
        print("  BAD", b)
    if missing:
        print(f"  no picture kept yet ({len(missing)}): {', '.join(missing)}")
    if stale:
        print(f"  kept from an older recipe ({len(stale)}; python tools/propgen.py thumbs --make {' '.join(stale[:6])}...): {', '.join(stale)}")
    if bad:
        print(f"THUMBS failed: {len(bad)} bad")
        return 1
    print(f"THUMBS ok ({n_ok} pictures kept, {n_st} with sticker passes; {len(missing)} not yet, {len(stale)} from an older recipe)")
    return 0

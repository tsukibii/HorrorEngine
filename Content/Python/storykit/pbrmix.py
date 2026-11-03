"""Made sets: a PBR set off the shelf as a street paints it, tinted and layered (docs/STREET_PAINT.md §3b; the user,
2026-10-31: "the actual materials should be PBRs", "layer the stuff you made with the PBRs too (mainly decals, added wear
etc)", "modify the tint of the colour (fade it out, make it more contrast etc)").

A street's look on a slot is a colour ("#rrggbb"), a set ("pbr/<set>"), or a set with what's done to it; a room's
look (its floor, walls, ceiling, trim) and a block's `mat` take the same (the user, 2026-10-31: the paint bucket in the
interiors; STORY_FORMAT §1):

    {"set": "pbr/concrete/Concrete027_1K-PNG",
     "scale": 1, "turn": 0,                               the set's size times this; turned 0, 90, 180 or 270 degrees
     "tint": "#a48e93", "tint_amount": 1,                  its colour moved to the tint (the pattern's light and dark kept)
     "brightness": 1, "contrast": 1, "saturation": 1, "hue": 0, "fade": 0,
     "roughness": 1, "bump": 1,                           its shine (rougher over 1) and its relief (the normal map's)
     "layers": [
       {"set": "pbr/foliage/Moss002_1K-PNG", "amount": 0.6, "mask": "patches", "coverage": 0.3, "softness": 0.5,
        "size": 0.8, "seed": 3, "scale": 1, "affects": "all", ...its own tint, brightness...},
       {"decal": "scuffs", "count": 4, "size": 1, "seed": 2, "spin": 0, "amount": 1},
       {"wear": "streaks", "amount": 1.5}]}

A set layer lies over the set in patches (soft blobs `size` metres across covering `coverage` of it), by its own
opacity map ("own", the fingerprints' and the imperfections'), both ("own+patches") or all over ("all"), changing its
colour, shine and relief ("all"), only its shine and relief ("shine": prints, smudges) or only its colour ("colour").
A decal layer scatters one of the street's decals (assets/decals, decals.py: scuffs, prints, gum, cracks, stains,
stickers...) `count` times over each repeat at its own size times `size`, upright or turned at random (`spin`), wrapping
round the edges so the set still tiles; its colour and shine over the set's. A wear layer scales the bake's wear on that surface (grime, rain streaks, worn edges, damp: Blender's and the Godot
plugin's, from the street's wear atlas): 0 none, 1 as the street wears, 2 twice.

`made(look)` makes such a look into a set of its own on the shelf, `pbr/_made/<hash>` (assets/pbr/_made: not in git,
made again from the recipe whenever it's missing): tileable at its new size, every map in it, the recipe and the wear
in its meta.json. The paint page asks the desk's server for it, Blender's bake reads it as any set and the .glb carries
its maps to Godot, so the three show the same thing. numpy and PIL: plain Python.
"""
import hashlib
import json
import math
import os
import shutil
import threading

from . import pbr as PBR


class _Numpy:
    """numpy, imported when pixels are first made: a story's plan and its check read looks (canon, key, problems)
    without it."""
    def __getattr__(self, k):
        import numpy
        globals()["np"] = numpy
        return getattr(numpy, k)


np = _Numpy()

VERSION = 1
LOOK = {"scale": 1.0, "turn": 0, "tint": "", "tint_amount": 1.0, "brightness": 1.0, "contrast": 1.0, "saturation": 1.0,
        "hue": 0.0, "fade": 0.0, "roughness": 1.0, "bump": 1.0}
LAYER = {"amount": 1.0, "mask": "patches", "coverage": 0.5, "softness": 0.5, "size": 1.0, "seed": 1, "scale": 1.0,
         "affects": "all", "tint": "", "tint_amount": 1.0, "brightness": 1.0, "contrast": 1.0, "saturation": 1.0,
         "hue": 0.0}
RANGE = {"scale": (0.1, 10), "turn": (0, 270), "tint_amount": (0, 1), "brightness": (0, 3), "contrast": (0, 3),
         "saturation": (0, 3), "hue": (-180, 180), "fade": (0, 1), "roughness": (0, 3), "bump": (0, 4), "amount": (0, 2),
         "coverage": (0, 1), "softness": (0, 1), "size": (0.05, 20), "seed": (0, 9999)}
DECAL = {"amount": 1.0, "count": 3, "size": 1.0, "seed": 1, "spin": 0, "affects": "all"}
RANGE.update({"count": (1, 60), "spin": (0, 1)})
MASKS = ("patches", "own", "own+patches", "all")
AFFECTS = ("all", "shine", "colour")
WEAR = {"grime": "dirt", "streaks": "streaks", "edges": "edges", "damp": "wet"}      # a wear layer -> the bake's amount
LUMA = (0.2126, 0.7152, 0.0722)                    # Rec. 709 luminance weights (an array where it's used)
_LOCK = threading.Lock()                        # one set made at a time (the desk's server answers on threads)


def spec():
    """What a look may say, for the street check (streetcheck.mjs compares its own copy with this)."""
    return {"look": LOOK, "layer": LAYER, "decal": DECAL, "range": RANGE, "masks": list(MASKS), "affects": list(AFFECTS), "wear": list(WEAR)}


def decals():
    """(folder, catalogue) of the street's decals (tools/streetbake/decals.py makes them: `street.py decals`)."""
    d = PBR.L.ROOT / "assets" / "decals"
    try:
        return d, json.loads((d / "decals.json").read_text(encoding="utf-8"))["decals"]
    except (OSError, ValueError, KeyError):
        return d, {}


def _has(ref):
    return PBR.set_dir(ref).is_dir() and PBR.meta(PBR.set_dir(ref)) is not None


def problems(look):
    """(errors, warnings) of a look as a street says it: words it doesn't have, numbers out of range; a set not on this
    machine's shelf is a warning (the shelf is the machine's)."""
    errs, warns = [], []
    if isinstance(look, str):
        if look.startswith("#"):
            if len(look) != 7 or any(ch not in "0123456789abcdefABCDEF" for ch in look[1:]):
                errs.append(f"{look!r} isn't a colour (#rrggbb)")
        elif look.startswith("pbr/"):
            if not _has(look):
                warns.append(f"{look} isn't on this machine's shelf")
        else:
            errs.append(f"{look!r}: a look is #rrggbb, pbr/<set> or {{set, ...}}")
        return errs, warns
    if not isinstance(look, dict) or not str(look.get("set", "")).startswith("pbr/"):
        return [f"a look object needs its set (pbr/<set>): {json.dumps(look)[:80]}"], warns

    def fields(o, allowed, where):
        for k, v in o.items():
            if k not in allowed:
                errs.append(f"{where}: no {k!r} (it has {', '.join(sorted(allowed))})")
            elif k in RANGE:
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    errs.append(f"{where}: {k} is a number, not {v!r}")
                elif not RANGE[k][0] <= v <= RANGE[k][1]:
                    errs.append(f"{where}: {k} {v} is outside {RANGE[k][0]} to {RANGE[k][1]}")
            elif k == "tint" and v and not (isinstance(v, str) and len(v) == 7 and v.startswith("#")):
                errs.append(f"{where}: tint is #rrggbb, not {v!r}")
        if "set" in o and not _has(o["set"]):
            warns.append(f"{where}: {o['set']} isn't on this machine's shelf")
    fields(look, set(LOOK) | {"set", "layers"}, look["set"])
    if look.get("turn", 0) not in (0, 90, 180, 270):
        errs.append(f"{look['set']}: turn is 0, 90, 180 or 270, not {look.get('turn')}")
    if not isinstance(look.get("layers", []), list):
        errs.append(f"{look['set']}: layers is a list")
        return errs, warns
    for i, L in enumerate(look.get("layers", [])):
        where = f"{look['set']} layer {i + 1}"
        if not isinstance(L, dict):
            errs.append(f"{where}: a layer is {{set, ...}} or {{wear, amount}}")
        elif "wear" in L:
            if L["wear"] not in WEAR:
                errs.append(f"{where}: wear is {', '.join(WEAR)}, not {L['wear']!r}")
            fields(L, {"wear", "amount"}, where)
        elif "decal" in L:
            cat = decals()[1]
            if cat and L["decal"] not in cat:
                errs.append(f"{where}: no decal {L['decal']!r} (decals.py makes {', '.join(sorted(cat))})")
            elif not cat:
                warns.append(f"{where}: the decals aren't made on this machine (python tools/street.py decals)")
            fields(L, set(DECAL) | {"decal"}, where)
            if L.get("affects", "all") not in AFFECTS:
                errs.append(f"{where}: affects is {', '.join(AFFECTS)}, not {L.get('affects')!r}")
        elif not str(L.get("set", "")).startswith("pbr/"):
            errs.append(f"{where}: a set layer needs its set (pbr/<set>)")
        else:
            fields(L, set(LAYER) | {"set"}, where)
            if L.get("mask", "patches") not in MASKS:
                errs.append(f"{where}: mask is {', '.join(MASKS)}, not {L.get('mask')!r}")
            if L.get("affects", "all") not in AFFECTS:
                errs.append(f"{where}: affects is {', '.join(AFFECTS)}, not {L.get('affects')!r}")
    return errs, warns


def _num(v, k, d):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    lo, hi = RANGE.get(k, (-1e9, 1e9))
    return max(lo, min(hi, x))


def canon(look):
    """A look with its defaults taken out and its numbers rounded: the same look, the same set. A string as it is."""
    if not isinstance(look, dict):
        return look
    out = {"set": str(look.get("set", ""))}
    for k, d in LOOK.items():
        if k in ("tint", "tint_amount"):
            continue
        v = look.get(k, d)
        if k == "turn":
            v = int(round(_num(v, k, 0) / 90.0)) % 4 * 90
        else:
            v = round(_num(v, k, d), 3)
        if v != d:
            out[k] = v
    _tint(look, out)
    layers = []
    for L in look.get("layers") or []:
        if not isinstance(L, dict):
            continue
        if L.get("wear") in WEAR:
            layers.append({"wear": L["wear"], "amount": round(_num(L.get("amount", 1.0), "amount", 1.0), 3)})
            continue
        if L.get("decal"):
            c = {"decal": str(L["decal"])}
            for k, d in DECAL.items():
                v = L.get(k, d)
                v = (v if v in AFFECTS else d) if k == "affects" else int(_num(v, k, d)) if k in ("count", "seed", "spin") else round(_num(v, k, d), 3)
                if v != d:
                    c[k] = v
            layers.append(c)
            continue
        if not str(L.get("set", "")).startswith("pbr/"):
            continue
        c = {"set": str(L["set"])}
        for k, d in LAYER.items():
            if k in ("tint", "tint_amount"):
                continue
            v = L.get(k, d)
            if k == "mask":
                v = v if v in MASKS else d
            elif k == "affects":
                v = v if v in AFFECTS else d
            elif k == "seed":
                v = int(_num(v, k, d))
            else:
                v = round(_num(v, k, d), 3)
            if v != d:
                c[k] = v
        _tint(L, c)
        layers.append(c)
    if layers:
        out["layers"] = layers
    return out


def _tint(src, out):
    t = str(src.get("tint") or "").lower()
    if len(t) == 7 and t.startswith("#") and all(ch in "0123456789abcdef" for ch in t[1:]):
        out["tint"] = t
        a = round(_num(src.get("tint_amount", 1.0), "tint_amount", 1.0), 3)
        if a != 1.0:
            out["tint_amount"] = a


def sets_of(look):
    """Every set a look paints with: its own and its layers'."""
    c = canon(look)
    if isinstance(c, str):
        return [c] if c.startswith("pbr/") else []
    return [c["set"]] + [L["set"] for L in c.get("layers", []) if "set" in L]


def key(look):
    """The made set's name: its recipe and what its sets' files are now."""
    c = canon(look)
    h = hashlib.sha1(f"v{VERSION}|{json.dumps(c, sort_keys=True)}".encode())
    for ref in sets_of(look):
        m = PBR.meta(PBR.set_dir(ref)) if PBR.set_dir(ref).is_dir() else None
        h.update(f"|{ref}:{m['stamp'] if m else '-'}:{(m or {}).get('tile_m')}".encode())
    dd, cat = decals()
    for L in (c.get("layers", []) if isinstance(c, dict) else []):
        if "decal" in L and L["decal"] in cat:
            f = dd / cat[L["decal"]]["file"]
            h.update(f"|decal:{L['decal']}:{f.stat().st_size if f.is_file() else 0}:{cat[L['decal']].get('size')}".encode())
    return h.hexdigest()[:12]


def ref_of(look):
    """The ref a look paints with, nothing made: a colour or a plain set as it is, a tuned set its made set's
    (pbr/_made/<key>: what draws it makes it with `made`). A room's look and a prop's mat go into the plan as this."""
    c = canon(look)
    if isinstance(c, str) or set(c) == {"set"}:
        return c if isinstance(c, str) else c["set"]
    return f"pbr/_made/{key(look)}"


def made(look, write=True):
    """(ref, meta) of the set a look paints with: a colour or a plain set as it is (meta None), else its made set (made
    now when `write` and it's missing)."""
    c = canon(look)
    if isinstance(c, str):
        return c, None
    if not c["set"].startswith("pbr/"):
        raise ValueError(f"a look's set is pbr/<set>, not {c['set']!r}")
    if set(c) == {"set"}:
        return c["set"], None
    bd = PBR.set_dir(c["set"])
    bm = PBR.meta(bd) if bd.is_dir() else None
    if bm is None:
        raise ValueError(f"no set {c['set']} on the shelf")
    h = key(look)
    ref, d = f"pbr/_made/{h}", PBR.ROOT / "_made" / h
    if (d / "meta.json").is_file():
        return ref, PBR.meta(d)
    if not write:
        return ref, None
    with _LOCK:
        if (d / "meta.json").is_file():
            return ref, PBR.meta(d)
        return ref, _make(d, h, c, bd, bm)


def _make(d, h, c, bd, bm):
    tmp = d.with_name(h + ".part")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    _build(tmp, h, c, bd, bm)
    shutil.rmtree(d, ignore_errors=True)
    tmp.rename(d)
    return PBR.meta(d, write=True)


# ---- pixels ----------------------------------------------------------------------------------------------------------

def _img():
    from PIL import Image
    return Image


def _read(path, mode):
    Image = _img()
    with Image.open(path) as im:
        if mode == "L" and im.mode.startswith("I"):           # a 16-bit grey map (ambientCG's displacement)
            a = np.asarray(im).astype(np.float32)
            return a / (65535.0 if a.max() > 255 else 255.0)
        return np.asarray(im.convert(mode), dtype=np.float32) / 255.0


def _write(path, a, bits=8):
    Image = _img()
    if bits == 16 and a.ndim == 2:
        Image.fromarray(np.clip(a * 65535.0 + 0.5, 0, 65535).astype(np.uint16)).save(path, compress_level=3)
        return
    u = np.clip(a * 255.0 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(u).save(path, compress_level=3)


def _resize(a, w, h):
    """An image (H x W [x C], 0..1) at w x h."""
    if a.shape[1] == w and a.shape[0] == h:
        return a
    Image = _img()
    chans = [a] if a.ndim == 2 else [a[..., i] for i in range(a.shape[2])]
    out = [np.asarray(Image.fromarray(ch.astype(np.float32), mode="F").resize((w, h), Image.BILINEAR)) for ch in chans]
    return out[0] if a.ndim == 2 else np.stack(out, axis=-1)


def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5)], dtype=np.float32)


def _hue(a, deg):
    t = math.radians(deg)
    yiq = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]], dtype=np.float32)
    rot = np.array([[1, 0, 0], [0, math.cos(t), -math.sin(t)], [0, math.sin(t), math.cos(t)]], dtype=np.float32)
    m = np.linalg.inv(yiq) @ rot @ yiq
    return np.clip(a @ m.T, 0, 1)


def adjust(a, p):
    """An albedo's colour (sRGB, H x W x 3, 0..1) as a look says: hue, saturation and contrast about its own mean (in
    sRGB, as the eye sees them), then the tint (linear: each pixel's lightness against the mean's kept, its colour the
    tint's, so all of it averages the tint), brightness (linear), and a fade toward a pale, washed-out version of
    itself (sun-bleached)."""
    if p.get("hue"):
        a = _hue(a, p["hue"])
    s = p.get("saturation", 1.0)
    if s != 1.0:
        y = (a @ np.array(LUMA, dtype=np.float32))[..., None]
        a = np.clip(y + (a - y) * s, 0, 1)
    k = p.get("contrast", 1.0)
    if k != 1.0:
        m = a.reshape(-1, 3).mean(axis=0)
        a = np.clip(m + (a - m) * k, 0, 1)
    lin = to_lin(a)
    if p.get("tint"):
        t = to_lin(hex_rgb(p["tint"]))
        y = lin @ np.array(LUMA, dtype=np.float32)
        col = t[None, None, :] * (y / max(float(y.mean()), 1e-4))[..., None]
        ta = p.get("tint_amount", 1.0)
        lin = lin * (1 - ta) + col * ta
    b = p.get("brightness", 1.0)
    if b != 1.0:
        lin = lin * b
    a = to_srgb(lin)
    f = p.get("fade", 0.0)
    if f:
        y = (a @ np.array(LUMA, dtype=np.float32))[..., None]
        washed = (y + (a - y) * 0.35) * 0.7 + 0.3 * 0.85
        a = a * (1 - f) + washed * f
    return np.clip(a, 0, 1).astype(np.float32)


def patches(h, w, size_px, coverage, softness, seed):
    """Soft blobs `size_px` across covering `coverage` of an h x w tile, tiling with it (a periodic blur of noise)."""
    if coverage >= 0.999:
        return np.ones((h, w), np.float32)
    if coverage <= 0.001:
        return np.zeros((h, w), np.float32)
    n = np.random.default_rng(int(seed)).standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    sig = max(size_px, 1.0) / 2.5
    f = np.real(np.fft.ifft2(np.fft.fft2(n) * np.exp(-2 * np.pi ** 2 * sig ** 2 * (fx ** 2 + fy ** 2))))
    f = (f - f.mean()) / (f.std() + 1e-8)
    t = float(np.quantile(f, 1 - coverage))
    wd = 0.05 + softness * 1.2
    x = np.clip((f - (t - wd / 2)) / wd, 0, 1)
    return (x * x * (3 - 2 * x)).astype(np.float32)


def _maps(d, m):
    """A set's maps as arrays at its own size: albedo (RGB), alpha (or None), normal (GL, -1..1), rough, ao, height,
    metal, opacity (each H x W or None)."""
    mp = m["maps"]
    al = _read(d / mp["albedo"], "RGBA")
    out = {"albedo": al[..., :3], "alpha": al[..., 3] if al[..., 3].min() < 0.999 else None}
    if "normal" in mp:
        n = _read(d / mp["normal"], "RGB") * 2 - 1
        if m.get("normal") == "dx":
            n[..., 1] = -n[..., 1]
        out["normal"] = n
    for k in ("rough", "ao", "height", "metal", "opacity"):
        out[k] = _read(d / mp[k], "L") if k in mp else None
    return out


def _turn(M, q):
    """Every map turned q quarter turns anticlockwise (a normal's x and y with it)."""
    if not q:
        return M
    out = {}
    for k, a in M.items():
        if a is None:
            out[k] = None
            continue
        r = np.rot90(a, q).copy()
        if k == "normal":
            x, y = r[..., 0].copy(), r[..., 1].copy()
            r[..., 0], r[..., 1] = [(-y, x), (-x, -y), (y, -x)][q - 1]
        out[k] = r
    return out


def _fit(a, w, h, nu, nv):
    """A layer's map repeated nu x nv times over a w x h tile."""
    if a is None:
        return None
    small = _resize(a, max(1, w // nu), max(1, h // nv))
    t = np.tile(small, (nv, nu) + ((1,) if a.ndim == 3 else ()))
    return _resize(t, w, h)


def _unit(n):
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)


COLOUR = ("tint", "brightness", "contrast", "saturation", "hue", "fade")


def _build(d, h, c, bd, bm):
    M = _maps(bd, bm)
    tu, tv = float(bm.get("tile_m") or 2.0), float(bm.get("tile_v_m") or bm.get("tile_m") or 2.0)
    q = c.get("turn", 0) // 90
    M = _turn(M, q)
    changed = set(M) if q else set()                     # the maps that differ from the set's own (the rest are linked)
    if any(k in c for k in COLOUR):
        changed.add("albedo")
    if q % 2:
        tu, tv = tv, tu
    sc = c.get("scale", 1.0)
    tu, tv = tu * sc, tv * sc
    H, W = M["albedo"].shape[:2]
    M["albedo"] = adjust(M["albedo"], c)
    if M["rough"] is not None and c.get("roughness", 1.0) != 1.0:
        M["rough"] = np.clip(M["rough"] * c["roughness"], 0, 1)
        changed.add("rough")
    elif M["rough"] is None and c.get("roughness", 1.0) != 1.0:
        M["rough"] = np.full((H, W), min(1.0, 0.8 * c["roughness"]), np.float32)
        changed.add("rough")
    if M.get("normal") is not None and c.get("bump", 1.0) != 1.0:
        n = M["normal"].copy()
        n[..., :2] *= c["bump"]
        M["normal"] = _unit(n)
        changed.add("normal")
    wear = {}
    for L in c.get("layers", []):
        if "wear" in L:
            wear[WEAR[L["wear"]]] = L["amount"]
            continue
        if "decal" in L:
            changed |= {"albedo"} if L.get("affects") == "colour" else {"rough"} if L.get("affects") == "shine" else {"albedo", "rough"}
            _decal_layer(M, L, W, H, tu, tv)
            continue
        ld = PBR.set_dir(L["set"])
        lm = PBR.meta(ld) if ld.is_dir() else None
        if lm is None:
            raise ValueError(f"no set {L['set']} on the shelf (a layer of {c['set']})")
        X = _maps(ld, lm)
        X["albedo"] = adjust(X["albedo"], L)
        lt = float(lm.get("tile_m") or 1.0) * L.get("scale", 1.0)
        ltv = float(lm.get("tile_v_m") or lm.get("tile_m") or 1.0) * L.get("scale", 1.0)
        nu, nv = max(1, round(tu / lt)), max(1, round(tv / ltv))     # whole repeats in the tile, so it still tiles
        F = {k: _fit(a, W, H, nu, nv) for k, a in X.items()}
        mask = np.full((H, W), float(L.get("amount", 1.0)), np.float32)
        mk = L.get("mask", "patches")
        if mk in ("patches", "own+patches"):
            mask *= patches(H, W, L.get("size", 1.0) / tu * W, L.get("coverage", 0.5), L.get("softness", 0.5), L.get("seed", 1))
        if mk in ("own", "own+patches"):
            own = F["opacity"] if F["opacity"] is not None else F["alpha"]
            if own is not None:
                mask *= own
        mask = np.clip(mask, 0, 1)
        m3 = mask[..., None]
        aff = L.get("affects", "all")
        changed |= {"albedo"} if aff == "colour" else {"rough", "normal"} if aff == "shine" else {"albedo", "rough", "normal", "ao", "height", "metal"}
        if aff in ("all", "colour"):
            M["albedo"] = M["albedo"] * (1 - m3) + F["albedo"] * m3
        if aff in ("all", "shine"):
            br = M["rough"] if M["rough"] is not None else np.full((H, W), 0.8, np.float32)
            lr = F["rough"] if F["rough"] is not None else np.full((H, W), 0.8, np.float32)
            M["rough"] = br * (1 - mask) + lr * mask
            if F.get("normal") is not None:
                bn = M["normal"] if M.get("normal") is not None else np.dstack([np.zeros((H, W)), np.zeros((H, W)), np.ones((H, W))]).astype(np.float32)
                M["normal"] = _unit(bn * (1 - m3) + F["normal"] * m3)
        if aff == "all":
            for k, dflt in (("ao", 1.0), ("height", 0.5), ("metal", 0.0)):
                if M[k] is None and F[k] is None:
                    continue
                b = M[k] if M[k] is not None else np.full((H, W), dflt, np.float32)
                x = F[k] if F[k] is not None else np.full((H, W), dflt, np.float32)
                M[k] = b * (1 - mask) + x * mask
    names = {"albedo": "albedo", "normal": "normal", "rough": "roughness", "ao": "ao", "height": "height", "metal": "metalness", "opacity": "opacity"}
    for k, name in names.items():
        a = M.get(k)
        if a is None:
            continue
        src = bm["maps"].get(k)
        if k not in changed and src and not (k == "normal" and bm.get("normal") == "dx"):
            dst = d / f"{h}_{name}{os.path.splitext(src)[1].lower()}"
            try:
                os.link(bd / src, dst)                        # the set's own map, as it is: no copy
            except OSError:
                shutil.copyfile(bd / src, dst)
            continue
        if k == "albedo":
            a = a if M["alpha"] is None else np.dstack([a, M["alpha"]])
        elif k == "normal":
            a = a * 0.5 + 0.5
        _write(d / f"{h}_{name}.png", a, 16 if k == "height" else 8)
    bits = [x for x, on in (("tinted", "tint" in c), ("faded", "fade" in c), ("contrast", "contrast" in c),
                            (f"x{c.get('scale')}", "scale" in c), (f"turned {c.get('turn')}", "turn" in c)) if on]
    nl = sum(1 for L in c.get("layers", []) if "set" in L)
    if nl:
        bits.append(f"{nl} layer{'s' if nl > 1 else ''}")
    if wear:
        bits.append("wear " + ", ".join(f"{k} x{v}" for k, v in wear.items()))
    meta = {"label": f"{bm.get('label') or c['set'].split('/')[-1]} ({', '.join(bits) or 'made'})", "tile_m": round(tu, 4),
            "source": "made", "licence": bm.get("licence", "CC0-1.0"), "recipe": c, "wear": wear}
    if abs(tv - tu) > 1e-6:
        meta["tile_v_m"] = round(tv, 4)
    (d / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


def _decal_layer(M, L, W, H, tu, tv):
    """A decal scattered over the tile, wrapping round its edges; its colour and shine laid over the set's."""
    Image = _img()
    dd, cat = decals()
    info = cat.get(L["decal"])
    if not info:
        raise ValueError(f"no decal {L['decal']} (python tools/street.py decals)")
    src = Image.open(dd / info["file"]).convert("RGBA")
    rng = np.random.default_rng(int(L.get("seed", 1)))
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wpx, hpx = info["size"][0] * L.get("size", 1.0) / tu * W, info["size"][1] * L.get("size", 1.0) / tv * H
    for _ in range(int(L.get("count", 3))):
        k = rng.uniform(0.8, 1.2)
        im = src.resize((max(2, int(wpx * k)), max(2, int(hpx * k))), Image.LANCZOS)
        if L.get("spin", 0):
            im = im.rotate(rng.uniform(0, 360), expand=True, resample=Image.BICUBIC)
        x, y = int(rng.uniform(0, W)) - im.width // 2, int(rng.uniform(0, H)) - im.height // 2
        for dx in (-W, 0, W):
            for dy in (-H, 0, H):
                X, Y = x + dx, y + dy
                if X >= W or Y >= H or X + im.width <= 0 or Y + im.height <= 0:
                    continue
                sx, sy = max(0, -X), max(0, -Y)
                part = im.crop((sx, sy, min(im.width, W - X), min(im.height, H - Y)))
                canvas.alpha_composite(part, (X + sx, Y + sy))
    a = np.asarray(canvas, dtype=np.float32) / 255.0
    m = np.clip(a[..., 3] * float(L.get("amount", 1.0)), 0, 1)
    aff = L.get("affects", "all")
    if aff in ("all", "colour"):
        M["albedo"] = M["albedo"] * (1 - m[..., None]) + a[..., :3] * m[..., None]
    if aff in ("all", "shine") and info.get("rough") is not None:
        r = M["rough"] if M["rough"] is not None else np.full((H, W), 0.8, np.float32)
        M["rough"] = r * (1 - m) + float(info["rough"]) * m


def clean(keep_refs, older=86400):
    """Made sets no street uses taken off the shelf once they're a day old (a brush tuned in the paint page and not yet
    painted and saved is younger); how many."""
    import time
    root = PBR.ROOT / "_made"
    if not root.is_dir():
        return 0
    keep = {r.split("/")[-1] for r in keep_refs}
    n = 0
    for d in root.iterdir():
        if d.is_dir() and d.name not in keep and time.time() - d.stat().st_mtime > older:
            shutil.rmtree(d, ignore_errors=True)
            n += 1
    return n


if __name__ == "__main__":                       # the street check's: looks in (JSON on stdin), their problems out
    import sys
    print(json.dumps([problems(v) for v in json.load(sys.stdin)]))

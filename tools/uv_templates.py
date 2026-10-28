"""Texture templates for the placeholder things, to paint in Krita (HANDOFF_DIRECTOR_TODO §6, DECISIONS 2026-10-28,
night). Every thing a game places as a block (a box at its real size, a thin one for paper and cards) has its UVs laid
out the same way every time, and a template to paint them on:

  python tools/uv_templates.py --game G [thing ...] [--px 2048]
      writes, per thing, into Content/Games/<G>/Art/Textures/<thing>/ (the user's hand work's place):
      <thing>.ora        OpenRaster, which Krita opens with its layers: Guide (each face's outline and name, which way
                         is up, the fold lines, the bleed shaded; locked), Paint (empty: yours), Base (a flat mid grey)
      <thing>_guide.png  the guide alone, for other apps
      <thing>.json       the layout: the size it was made for, and each face's rectangle in the picture with which way
                         its u and v run along the block; the desk lays the block's UVs from it (and Unreal will)
  python tools/uv_templates.py --game G list     each thing: its size, its layout, a template, a painting, stale ones
  python tools/uv_templates.py check             UVTEMPLATES ok

A **box** is a cross net: the front in the middle, the top above it, the bottom below it, the left and the right
beside it, the back at the far end; every face at its real size on one scale (nothing stretched), 8 px of bleed round
each island. A **plane** (a note, a card, a mat: its thinnest side an eighth of the next or less, 2 cm at most) is
its front and its back side by side. A **photo** (photo, polaroid, picture or print in its id or tag) is only its
print, at its real aspect: a frame is a part of its own wearing a PBR set off the shelf, never in the template.

The way back: the flattened `<thing>.png` saved beside them (the guide hidden) is the thing's base colour on the desk
(and in Unreal, picked up on its next build); nothing to wire by hand. A template made again for a thing whose size
changed never overwrites a painted .ora (it writes `<thing>_new.ora` beside it); the story check warns when a
painting's proportions no longer match its thing.

Axes are the story's, in the thing's own frame (at rot 0): x east (its width w), y north (its depth d), z up (its
height h); its front faces south (-y), as a kit's does.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import quoteattr

ROOT = Path(__file__).resolve().parents[1]
GAMES = ROOT / "Content" / "Games"
BLEED = 8                                   # px round each island
PX = 2048
FACES = ("front", "back", "left", "right", "top", "bottom")
SIZE_OF = {"x": 0, "y": 1, "z": 2}          # an axis's size in [w, d, h]
PHOTO = re.compile(r"(^|[_\W])(photo|photos|polaroid|picture|print)([_\W]|$)", re.I)
# how u and v run on each face of a box's net (story axes, in the thing's frame): [axis, sign]; u left to right, v
# bottom to top of the face's island, so a face's island joins its neighbour's along the edge they share when folded
NET = {
    "front":  (("x", 1), ("z", 1)),
    "right":  (("y", 1), ("z", 1)),
    "back":   (("x", -1), ("z", 1)),
    "left":   (("y", -1), ("z", 1)),
    "top":    (("x", 1), ("y", 1)),
    "bottom": (("x", 1), ("y", -1)),
}
# a plane's two sides by its thinnest axis: (front face, back face, u axis, v axis); the back turned over like a page
PLANE = {
    "z": ("top", "bottom", "x", "y"),      # lying flat: a note on a table, a mat
    "y": ("front", "back", "x", "z"),      # standing: a poster, a card on its edge
    "x": ("right", "left", "y", "z"),      # standing sideways
}


def pow2(n):
    p = 1
    while p < n:
        p *= 2
    return p


def kind_of(size, name=""):
    """box, plane or print: a photo is its print; a plane's thinnest side is an eighth of the next or less, 2 cm at most."""
    s = sorted(size)
    flat = s[0] <= 0.02 and s[0] <= s[1] / 8
    if PHOTO.search(name or ""):
        return "print"
    return "plane" if flat else "box"


def layout(size, kind="box", px=PX):
    """The template's layout for a block of size [w, d, h] (metres): the canvas [W, H] (powers of two, the longest side
    px), the scale (px a metre), and each face's island {rect: [x0, y0, x1, y1] (px, from the top left), u: [axis,
    sign], v: [axis, sign], label}; a face with no island of its own (a plane's and a print's edges, a print's back)
    takes `of` another's mapping (its pixels along that island's edge)."""
    w, d, h = (max(float(v), 1e-4) for v in size)
    dims = {"x": w, "y": d, "z": h}
    if kind == "box":
        cols, rows = [d, w, d, w], [d, h, d]                   # left front right back; top front bottom
        place = {"left": (0, 1), "front": (1, 1), "right": (2, 1), "back": (3, 1), "top": (1, 0), "bottom": (1, 2)}
    else:
        thin = min(dims, key=dims.get)
        fa, ba, ua, va = PLANE[thin]
        if kind == "print":
            cols, rows, place = [dims[ua]], [dims[va]], {fa: (0, 0)}
        else:
            cols, rows, place = [dims[ua], dims[ua]], [dims[va]], {fa: (0, 0), ba: (1, 0)}
    gap = 2 * BLEED
    wm, hm = sum(cols), sum(rows)
    gx, gy = gap * len(cols), gap * len(rows)                   # a bleed each side of every island
    s = min((px - gx) / wm, (px - gy) / hm)
    W, H = pow2(round(wm * s + gx)), pow2(round(hm * s + gy))
    W, H = min(W, px), min(H, px)
    out = {"kind": kind, "size": [round(w, 4), round(d, 4), round(h, 4)], "canvas": [W, H], "scale": round(s, 4), "bleed": BLEED, "faces": {}}
    x0s = [sum(cols[:i]) * s + gap * i + BLEED for i in range(len(cols))]
    y0s = [sum(rows[:j]) * s + gap * j + BLEED for j in range(len(rows))]
    for f, (i, j) in place.items():
        x0, y0 = x0s[i], y0s[j]
        rect = [round(x0), round(y0), round(x0 + cols[i] * s), round(y0 + rows[j] * s)]
        if kind == "box":
            u, v = NET[f]
        else:
            fa, ba, ua, va = PLANE[min(dims, key=dims.get)]
            u, v = ((ua, 1) if f == fa else (ua, -1)), (va, 1)
        out["faces"][f] = {"rect": rect, "u": list(u), "v": list(v)}
    if kind != "box":                                         # the edges (and a print's back) ride the front's island
        fa = PLANE[min(dims, key=dims.get)][0]
        for f in FACES:
            if f not in out["faces"]:
                out["faces"][f] = {"of": fa}
    return out


def uv_of(lay, face, p):
    """The UV (0..1, v up from the picture's bottom, as three.js and glTF read it with flipY) of a point p = (x, y, z) on
    a face of the block (story axes, the block's own frame, its middle at 0): what the desk lays on each corner."""
    f = lay["faces"][face]
    if "of" in f:
        f = lay["faces"][f["of"]]
    size, (W, H) = lay["size"], lay["canvas"]
    (ua, us), (va, vs) = f["u"], f["v"]
    lu = 0.5 + us * p[SIZE_OF[ua]] / size[SIZE_OF[ua]]
    lv = 0.5 + vs * p[SIZE_OF[va]] / size[SIZE_OF[va]]
    x0, y0, x1, y1 = f["rect"]
    return ((x0 + lu * (x1 - x0)) / W, 1 - (y1 - lv * (y1 - y0)) / H)


# ---- the pictures ----------------------------------------------------------------------------------------------------

def _font(size):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=max(10, int(size)))
    except TypeError:                                        # an older Pillow: its one small font
        return ImageFont.load_default()


def guide(lay, name=""):
    """The guide layer: the bleed shaded round each island, the islands' outlines (fold lines dashed, the cut edges
    solid), each face's name and size, an arrow for which way is up; transparent elsewhere."""
    from PIL import Image, ImageDraw
    W, H = lay["canvas"]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    faces = {k: f for k, f in lay["faces"].items() if "rect" in f}
    for f in faces.values():                                  # the bleed: what spills past the edge when it's sampled
        x0, y0, x1, y1 = f["rect"]
        dr.rectangle([x0 - BLEED, y0 - BLEED, x1 + BLEED - 1, y1 + BLEED - 1], fill=(255, 64, 160, 70))
    for f in faces.values():
        x0, y0, x1, y1 = f["rect"]
        dr.rectangle([x0, y0, x1 - 1, y1 - 1], fill=(0, 0, 0, 0))
    line = max(2, W // 700)
    folds = fold_edges(lay)
    for k, f in faces.items():
        x0, y0, x1, y1 = f["rect"]
        edges = {"left": ((x0, y0), (x0, y1 - 1)), "right": ((x1 - 1, y0), (x1 - 1, y1 - 1)), "top": ((x0, y0), (x1 - 1, y0)), "bottom": ((x0, y1 - 1), (x1 - 1, y1 - 1))}
        for side, (a, b) in edges.items():
            if (k, side) in folds:
                dashed(dr, a, b, (80, 220, 255, 255), line, max(6, W // 120))
            else:
                dr.line([a, b], fill=(255, 255, 255, 255), width=line)
        role = role_of(lay, k)
        size = face_size(lay, k)
        cw, ch = x1 - x0, y1 - y0
        fs = max(10, min(cw, ch) // 7)
        font, small = _font(fs), _font(max(9, fs * 0.55))
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        dr.text((cx, cy - fs * 0.15), role.upper(), font=font, fill=(255, 255, 255, 235), anchor="mm", stroke_width=max(1, fs // 14), stroke_fill=(0, 0, 0, 200))
        dr.text((cx, cy + fs * 0.75), f"{size[0] * 100:.4g} x {size[1] * 100:.4g} cm", font=small, fill=(220, 220, 220, 220), anchor="mm", stroke_width=1, stroke_fill=(0, 0, 0, 180))
        ax, top = cx, y0 + max(8, ch * 0.08)                  # which way is up: an arrow at the island's top
        al = max(8, min(ch * 0.18, fs * 1.2))
        dr.line([(ax, top + al), (ax, top)], fill=(255, 220, 90, 230), width=line)
        dr.polygon([(ax, top - line), (ax - al * 0.25, top + al * 0.3), (ax + al * 0.25, top + al * 0.3)], fill=(255, 220, 90, 230))
        dr.text((ax + al * 0.35, top + al * 0.15), "up", font=small, fill=(255, 220, 90, 230), anchor="lm")
    if name:
        dr.text((BLEED, H - BLEED), name, font=_font(max(10, W // 64)), fill=(255, 255, 255, 140), anchor="ld")
    return img


def dashed(dr, a, b, fill, width, dash):
    (ax, ay), (bx, by) = a, b
    n = max(1, int(max(abs(bx - ax), abs(by - ay)) / dash))
    for i in range(0, n, 2):
        t0, t1 = i / n, min(1, (i + 1) / n)
        dr.line([(ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)], fill=fill, width=width)


def fold_edges(lay):
    """The island edges that join another island when the net's folded: {(face, side)}."""
    if lay["kind"] != "box":
        return set()
    return {("front", "left"), ("left", "right"), ("front", "right"), ("right", "left"), ("right", "right"), ("back", "left"),
            ("front", "top"), ("top", "bottom"), ("front", "bottom"), ("bottom", "top")}


def role_of(lay, face):
    if lay["kind"] == "box":
        return face
    own = [k for k, f in lay["faces"].items() if "rect" in f]
    if lay["kind"] == "print":
        return "print"
    return "front" if face == own[0] else "back"


def face_size(lay, face):
    f = lay["faces"][face]
    size = lay["size"]
    return size[SIZE_OF[f["u"][0]]], size[SIZE_OF[f["v"][0]]]


def png_bytes(img):
    b = io.BytesIO()
    img.save(b, "PNG", optimize=True)
    return b.getvalue()


def write_ora(path, lay, gimg):
    """OpenRaster (Krita's layers): the mimetype first and stored, stack.xml (the top layer first), the layers, the
    merged picture and a thumbnail."""
    from PIL import Image
    W, H = lay["canvas"]
    base = Image.new("RGBA", (W, H), (128, 128, 128, 255))
    paint = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    merged = Image.alpha_composite(base, gimg)
    thumb = merged.copy()
    thumb.thumbnail((256, 256))
    layers = [("Guide", "data/guide.png", gimg, True), ("Paint", "data/paint.png", paint, False), ("Base", "data/base.png", base, False)]
    stack = ['<?xml version="1.0" encoding="UTF-8"?>', f'<image version="0.0.5" w="{W}" h="{H}" xres="72" yres="72">', " <stack>"]
    for name, src, _, locked in layers:
        stack.append(f'  <layer name={quoteattr(name)} src={quoteattr(src)} x="0" y="0" opacity="1.0" visibility="visible" '
                     f'composite-op="svg:src-over"{" edit-locked=\"true\"" if locked else ""}{" selected=\"true\"" if name == "Paint" else ""}/>')
    stack += [" </stack>", "</image>"]
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "image/openraster", compress_type=zipfile.ZIP_STORED)
        z.writestr("stack.xml", "\n".join(stack) + "\n", compress_type=zipfile.ZIP_DEFLATED)
        for _, src, img, _ in layers:
            z.writestr(src, png_bytes(img), compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("mergedimage.png", png_bytes(merged), compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("Thumbnails/thumbnail.png", png_bytes(thumb), compress_type=zipfile.ZIP_DEFLATED)


def ora_painted(path):
    """Whether an .ora's Paint layer has anything on it (a painted template is never overwritten)."""
    try:
        from PIL import Image
        with zipfile.ZipFile(path) as z:
            stack = z.read("stack.xml").decode("utf-8")
            m = re.search(r'name="Paint"[^>]*src="([^"]+)"', stack) or re.search(r'src="([^"]+)"[^>]*name="Paint"', stack)
            if not m:
                return True                                  # reworked in Krita (layers renamed, more of them): keep it
            img = Image.open(io.BytesIO(z.read(m.group(1)))).convert("RGBA")
            return img.getextrema()[3][1] > 0
    except Exception:
        return True


# ---- the game's things -----------------------------------------------------------------------------------------------

def parse_box(shape):
    m = re.match(r"^\s*box\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$", str(shape or ""))
    return [float(m.group(i)) for i in (1, 2, 3)] if m else None


SKIP_USES = {"clean"}                        # a stain is drawn by the desk (its blot), not painted


def things(story):
    """The game's placeholder things: every prop that's a plain box (not a kit thing, a library mesh or art, a stain),
    {id: {size, kind, room, level}}."""
    out = {}
    for lid, lv in (story.get("levels") or {}).items():
        for r in lv.get("rooms", []):
            for p in r.get("props", []):
                size = parse_box(p.get("shape"))
                if not size or p.get("use") in SKIP_USES or any(p.get(k) for k in ("kit", "mesh", "art", "asset", "preset", "look", "pbr")):
                    continue
                out[p["id"]] = {"size": size, "kind": kind_of(size, " ".join(str(p.get(k) or "") for k in ("id", "tag", "name"))), "room": r.get("id"), "level": lid}
    return out


def folder(game, tid):
    return GAMES / game / "Art" / "Textures" / tid


def make(game, tid, t, px=PX):
    """Writes the thing's template; says what it did."""
    d = folder(game, tid)
    d.mkdir(parents=True, exist_ok=True)
    lay = layout(t["size"], t["kind"], px)
    lay["thing"] = tid
    old = d / f"{tid}.json"
    before = json.loads(old.read_text(encoding="utf-8")) if old.exists() else None
    ora = d / f"{tid}.ora"
    target = ora
    if ora.exists() and ora_painted(ora) and before and before.get("size") != lay["size"]:
        target = d / f"{tid}_new.ora"                         # its paint kept: the new size beside it
    gimg = guide(lay, f"{tid} - {lay['kind']} - {' x '.join(f'{v * 100:.4g}' for v in lay['size'])} cm")   # (the default font has no ×)
    if target == ora and ora.exists() and ora_painted(ora) and before == lay:
        said = "kept (painted, the same size)"
    else:
        write_ora(target, lay, gimg)
        said = f"wrote {target.name}" + (" (the painted one kept: its size changed)" if target != ora else "")
    gimg.save(d / f"{tid}_guide.png")
    (d / f"{tid}.json").write_text(json.dumps(lay, indent=1) + "\n", encoding="utf-8")
    return said


def stale(game, tid, t):
    """'' when the thing's painting (if any) matches its size, else what's wrong."""
    d = folder(game, tid)
    j, png = d / f"{tid}.json", d / f"{tid}.png"
    if not j.exists():
        return ""
    lay = json.loads(j.read_text(encoding="utf-8"))
    if [round(v, 4) for v in t["size"]] != lay.get("size") and png.exists():
        a, b = sorted(lay.get("size") or [1, 1, 1]), sorted(t["size"])
        if any(abs(x / max(y, 1e-6) - 1) > 0.02 for x, y in zip(a, b)):
            return (f"its painting was made for {' × '.join(f'{v * 100:.4g}' for v in lay['size'])} cm, it's "
                    f"{' × '.join(f'{v * 100:.4g}' for v in t['size'])} cm now: make its template again (tools/uv_templates.py) and move the paint over")
    return ""


def load_story(game):
    return json.loads((GAMES / game / "story.json").read_text(encoding="utf-8"))


def cmd_make(a):
    S = load_story(a.game)
    th = things(S)
    names = [x for x in a.things if x != "list"]
    missing = [x for x in names if x not in th]
    if missing:
        print(f"not a placeholder thing in {a.game}: {', '.join(missing)} (python tools/uv_templates.py --game {a.game} list)")
        return 1
    for tid in names or sorted(th):
        t = th[tid]
        print(f"{tid:28s} {t['kind']:6s} {' × '.join(f'{v * 100:.4g}' for v in t['size'])} cm: {make(a.game, tid, t, a.px)}")
    print(f"the templates are in Content/Games/{a.game}/Art/Textures/<thing>/: open <thing>.ora in Krita, paint on Paint, hide Guide, "
          "and export <thing>.png beside it (the desk wears it on the next load)")
    return 0


def cmd_list(a):
    S = load_story(a.game)
    for tid, t in sorted(things(S).items()):
        d = folder(a.game, tid)
        has = [x for x, f in (("template", f"{tid}.ora"), ("painted", f"{tid}.png")) if (d / f).exists()]
        st = stale(a.game, tid, t)
        print(f"{tid:28s} {t['kind']:6s} {' × '.join(f'{v * 100:.4g}' for v in t['size']):>18s} cm  {', '.join(has) or '-'}" + (f"  STALE: {st}" if st else ""))
    return 0


# ---- UVTEMPLATES -----------------------------------------------------------------------------------------------------

def corners(size, face):
    """The four corners of a face of a block of size [w, d, h], its middle at 0 (story axes, the block's own frame)."""
    w, d, h = (v / 2 for v in size)
    axis, sign = {"front": ("y", -1), "back": ("y", 1), "left": ("x", -1), "right": ("x", 1), "top": ("z", 1), "bottom": ("z", -1)}[face]
    out = []
    for a in (-1, 1):
        for b in (-1, 1):
            p = {"x": None, "y": None, "z": None}
            p[axis] = sign * {"x": w, "y": d, "z": h}[axis]
            rest = [k for k in "xyz" if k != axis]
            p[rest[0]] = a * {"x": w, "y": d, "z": h}[rest[0]]
            p[rest[1]] = b * {"x": w, "y": d, "z": h}[rest[1]]
            out.append((p["x"], p["y"], p["z"]))
    return out


DESK_UVS = """
import { layUVs } from %s;
const cases = JSON.parse(process.argv[1]), out = [];
for (const c of cases) {                 // a three.js box's corners (x, y up, z south) and normals, a face's four each
  const P = [], N = [];
  for (const [f, ps] of Object.entries(c.corners)) for (const p of ps) { P.push([p[0], p[2], -p[1]]); N.push(c.normals[f].map((v, i) => v)); }
  const attr = a => ({ count: a.length, getX: i => a[i][0], getY: i => a[i][1], getZ: i => a[i][2] }), uv = { xy: [], setXY(i, u, v) { this.xy[i] = [u, v]; } };
  layUVs(attr(P), attr(N.map(n => [n[0], n[2], -n[1]])), uv, c.lay);
  out.push(uv.xy);
}
console.log(JSON.stringify(out));
"""
NORMALS = {"front": [0, -1, 0], "back": [0, 1, 0], "left": [-1, 0, 0], "right": [1, 0, 0], "top": [0, 0, 1], "bottom": [0, 0, -1]}


def desk_uvs(lays):
    """The desk's UVs (tools/director/painted.js, on a three.js box) at every face's corners of each layout, in the
    order of corners(): what UVTEMPLATES holds against uv_of. None when node can't run it."""
    data = [{"lay": lay, "corners": {f: corners(lay["size"], f) for f in FACES}, "normals": NORMALS} for lay in lays]
    script = DESK_UVS % json.dumps((ROOT / "tools" / "director" / "painted.js").as_uri())
    try:
        r = subprocess.run(["node", "--input-type=module", "-e", script, json.dumps(data)], capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def cmd_check(a):
    fails = []
    ok = lambda m: print("  ok  " + m)
    bad = lambda m: (fails.append(m), print("  FAIL " + m))
    cases = [("a box", [0.25, 0.2, 0.1], "box"), ("a tall box", [0.5, 0.5, 1.9], "box"), ("a key", [0.08, 0.03, 0.01], "box"),
             ("a note lying", [0.21, 0.3, 0.005], "plane"), ("a poster standing", [0.6, 0.004, 0.9], "plane"),
             ("a card sideways", [0.002, 0.063, 0.088], "plane"), ("an L print", [0.089, 0.127, 0.001], "print")]
    for what, size, want in cases:
        k = kind_of(size, "family_photo" if want == "print" else "thing")
        if k != want:
            bad(f"{what}: read as a {k}, not a {want}")
            continue
        lay = layout(size, k)
        W, H = lay["canvas"]
        rects = {f: v["rect"] for f, v in lay["faces"].items() if "rect" in v}
        probs = []
        if W & (W - 1) or H & (H - 1) or max(W, H) != PX:
            probs.append(f"canvas {W}×{H}")
        for f, (x0, y0, x1, y1) in rects.items():
            if x0 < BLEED or y0 < BLEED or x1 > W - BLEED or y1 > H - BLEED:
                probs.append(f"{f} past the canvas's bleed")
            su, sv = face_size(lay, f)                         # one scale: every island its real size
            if abs((x1 - x0) - su * lay["scale"]) > 1.01 or abs((y1 - y0) - sv * lay["scale"]) > 1.01:
                probs.append(f"{f} {x1 - x0}×{y1 - y0} px for {su}×{sv} m")
        for f, r in rects.items():                            # 2 × bleed between islands
            for g, q in rects.items():
                if f < g and not (r[2] + 2 * BLEED <= q[0] + 1 or q[2] + 2 * BLEED <= r[0] + 1 or r[3] + 2 * BLEED <= q[1] + 1 or q[3] + 2 * BLEED <= r[1] + 1):
                    probs.append(f"{f} and {g} closer than their bleed")
        for f in FACES:                                       # each face's corners land on its island's corners, in order
            for p in corners(lay["size"], f):
                u, v = uv_of(lay, f, p)
                if not (-1e-9 <= u <= 1 + 1e-9 and -1e-9 <= v <= 1 + 1e-9):
                    probs.append(f"{f} off the picture")
            if f in rects:
                x0, y0, x1, y1 = rects[f]
                got = sorted((round(u * W), round((1 - v) * H)) for u, v in (uv_of(lay, f, p) for p in corners(lay["size"], f)))
                if got != sorted([(x0, y0), (x1, y0), (x0, y1), (x1, y1)]):
                    probs.append(f"{f}'s corners {got}")
        if k == "box":                                        # folded, the net's neighbours share their edges
            for f, g, edge in (("front", "top", (0, -1, 1)), ("front", "left", (-1, -1, 0)), ("front", "right", (1, -1, 0)), ("front", "bottom", (0, -1, -1)), ("right", "back", (1, 1, 0))):
                ends = []
                ax = [i for i in range(3) if edge[i] == 0][0]
                for t in (-1, 1):
                    p = [edge[i] * lay["size"][i] / 2 for i in range(3)]
                    p[ax] = t * lay["size"][ax] / 2
                    (fu, fv), (gu, gv) = uv_of(lay, f, p), uv_of(lay, g, p)
                    ends.append(abs(fu * W - gu * W) + abs(fv * H - gv * H))
                if not all(abs(e - 2 * BLEED) <= 1.01 for e in ends):
                    probs.append(f"{f} and {g} don't meet along their fold ({[round(e, 1) for e in ends]} px)")
            want_rects = {"front", "back", "left", "right", "top", "bottom"}
        elif k == "plane":
            want_rects = 2
        else:
            want_rects = 1
        if (len(rects) != want_rects) if isinstance(want_rects, int) else (set(rects) != want_rects):
            probs.append(f"islands {sorted(rects)}")
        if k == "print" and len(rects) != 1:
            probs.append("a photo's template is its print alone")
        (bad if probs else ok)(f"{what} ({' × '.join(f'{v * 100:.4g}' for v in size)} cm): a {k}, {len(rects)} island{'s' if len(rects) > 1 else ''} on {W}×{H}"
                               + (f": {'; '.join(probs[:4])}" if probs else ", one scale, the bleed kept, every face's corners on its island" + (", folds meeting" if k == "box" else "")))
    lays = [layout(size, kind_of(size, "family_photo" if want == "print" else "thing")) for _, size, want in cases]
    desk = desk_uvs(lays)                                     # the desk lays the same UVs, face for face (painted.js)
    if desk is None:
        bad("the desk's UVs: node couldn't run tools/director/painted.js")
    else:
        off = [f"{what} {f}" for (what, _, _), lay, got in zip(cases, lays, desk)
               for f, uvs in zip(FACES, [got[i * 4:i * 4 + 4] for i in range(len(FACES))])
               if any(abs(u - w) > 1e-9 or abs(v - x) > 1e-9 for (u, v), (w, x) in zip(uvs, (uv_of(lay, f, p) for p in corners(lay["size"], f))))]
        (bad if off else ok)(f"the desk's UVs (painted.js on a three.js box) and the templates agree at every corner of every face of all {len(lays)}"
                             + (f": not {', '.join(off[:4])}" if off else ""))
    with tempfile.TemporaryDirectory() as tmp:               # the .ora: what Krita needs, the layers in order
        lay = layout([0.25, 0.2, 0.1], "box")
        p = Path(tmp) / "t.ora"
        write_ora(p, lay, guide(lay, "t"))
        with zipfile.ZipFile(p) as z:
            first = z.infolist()[0]
            stack = z.read("stack.xml").decode()
            names = re.findall(r'name="([^"]+)"', stack)
            from PIL import Image
            sizes = {n: Image.open(io.BytesIO(z.read(f"data/{n.lower()}.png"))).size for n in ("Guide", "Paint", "Base")}
            okk = (first.filename == "mimetype" and first.compress_type == zipfile.ZIP_STORED and z.read("mimetype") == b"image/openraster"
                   and names == ["Guide", "Paint", "Base"] and all(s == tuple(lay["canvas"]) for s in sizes.values())
                   and "mergedimage.png" in z.namelist() and "Thumbnails/thumbnail.png" in z.namelist())
        painted_empty = not ora_painted(p)
        (ok if okk and painted_empty else bad)(f"the .ora: mimetype first and stored, the layers {names} at {lay['canvas']}, the merged picture and a thumbnail; its Paint empty")
    for game in sorted(x.name for x in GAMES.iterdir() if (x / "story.json").exists()):     # the games' things, and any painting gone stale
        S = load_story(game)
        th = things(S)
        st = [f"{k}: {s}" for k, t in th.items() for s in [stale(game, k, t)] if s]
        made = sum((folder(game, k) / f"{k}.json").exists() for k in th)
        (bad if st else ok)(f"{game}: {len(th)} placeholder things ({sum(t['kind'] == 'box' for t in th.values())} boxes, "
                            f"{sum(t['kind'] == 'plane' for t in th.values())} planes, {sum(t['kind'] == 'print' for t in th.values())} prints), {made} with templates"
                            + (f"; stale: {'; '.join(st[:3])}" if st else ""))
    print("UVTEMPLATES ok" if not fails else f"UVTEMPLATES FAILED ({len(fails)})")
    return 0 if not fails else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("things", nargs="*", help="the things (their prop ids), or list, or check; all of them when none")
    ap.add_argument("--game", help="the game")
    ap.add_argument("--px", type=int, default=PX, help="the canvas's longest side (a power of two)")
    a = ap.parse_args()
    if a.things[:1] == ["check"]:
        return cmd_check(a)
    if not a.game:
        ap.error("--game G (or check)")
    if a.things[:1] == ["list"]:
        return cmd_list(a)
    if a.px & (a.px - 1):
        ap.error("--px: a power of two")
    return cmd_make(a)


if __name__ == "__main__":
    sys.exit(main())

"""Books: covers over a block of pages at a real paper size (A4, B5, A5, B6, a bunko, a shinsho, a manga's 新書判), printed
by designs whose title, author, picture and publisher's mark are the prop's own pictures to swap for yours (`pictures`:
"front.art", "front.title", "spine.title", "spine.logo", "back.*"; a page's "page_r.writing"...), as a can takes your
logo. Hardcovers and diaries have boards standing past their pages (the squares) and endpapers; paperbacks, bunko,
manga, textbooks and notebooks are flush. Closed (lying on their back, or standing spine out), open at a page (the spread
two pictures of their own), or several: a stack lying in a desk's book box or a row standing in a cubby, fitted to the
box they go in (`fit`: [w, d, h] mm, the place's inner size: KIT §10's places).

    {"family": "book", "kind": "hardcover" | "paperback" | "bunko" | "manga" | "textbook" | "notebook" | "diary",
     "size": "A5" | [w, h] (mm, the cover), "thick": 18 (mm), "binding": "left" | "right" (the spine's side, seen from
     the front: Japanese novels, manga and 国語 open from the right), "pose": "lie" | "stand" | "open", "open_at": 0.4,
     "art": {...the front's design and fields}, "spine": {...}, "back": {...}, "page_l": {...}, "page_r": {...},
     "arrange": "one" | "stack" | "row", "count": 0 (as many as fit), "fit": [w, d, h], "mix": [kinds], "titles": [...],
     "age": 0.2 (the pages' yellowing)}
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N

MM = 0.001
# paper sizes (w, h mm), the common Japanese ones first
SIZES = {"A4": (210, 297), "B5": (182, 257), "A5": (148, 210), "B6": (128, 182), "A6": (105, 148), "bunko": (106, 152),
         "shinsho": (105, 182), "tankobon": (113, 176), "notebook_B5": (179, 252), "letter": (216, 279)}
# a kind: its size, thickness, cover (board) and squares (mm), its front's and back's designs, its spine's colours
KINDS = {
    "hardcover": dict(size="A5", thick=24, board=2.6, squares=3.0, front="book_cover", back="book_back"),
    "paperback": dict(size="A5", thick=16, board=0.4, squares=0.0, front="book_cover", back="book_back"),
    "bunko": dict(size="bunko", thick=13, board=0.35, squares=0.0, front="book_cover", back="book_back"),
    "manga": dict(size="tankobon", thick=15, board=0.4, squares=0.0, front="manga_cover", back="book_back"),
    "textbook": dict(size="B5", thick=9, board=0.4, squares=0.0, front="textbook_cover", back="book_back"),
    "notebook": dict(size="notebook_B5", thick=5, board=0.35, squares=0.0, front="notebook_cover", back="notebook_back"),
    "diary": dict(size="A5", thick=20, board=2.4, squares=2.5, front="diary_cover", back="diary_cover"),
}
PALETTES = [["#6d2b2b", "#f1e9d6", "#c9a24a"], ["#1f3a5a", "#f3efe4", "#e0b04a"], ["#2f4a35", "#efe8d4", "#d8c48a"],
            ["#e9e2cf", "#2a2a2a", "#b8332f"], ["#3a2f4a", "#f0e6ff", "#d27ab0"], ["#c9a66b", "#2a1f14", "#7a2a1a"],
            ["#101418", "#e8e8e8", "#c0302a"], ["#b8c8c0", "#24322e", "#d06a3a"]]
TITLES = ["The Quiet House", "夜の教室", "Letters Never Sent", "放課後", "The Forty-Second Step", "雨の約束", "Under the Floorboards",
          "七不思議", "A Room Without Windows", "旧校舎", "The Last Bell", "鏡の中の少女", "Before the Lights Go Out", "名前のない手紙"]
AUTHORS = ["Mariko Hase", "瀬戸 一葉", "Ken Arata", "水城 灯", "Yuu Morimoto", "朝霧 さくら", "Ren Kuze", "白石 透"]
SUBJECTS = ["国語", "数学", "英語", "理科", "社会", "音楽"]


def size_of(spec, k):
    s = spec.get("size", KINDS[k]["size"])
    return SIZES[s] if isinstance(s, str) else tuple(float(v) for v in s)


def curved_block(wb, hb, t, z0, lift, I, top, side, bottom, mirror=False, nu=16, nv=5):
    """Half an open book's pages: from the gutter (x = 0) out `wb` mm to the fore-edge, `hb` mm up the page, `t` mm thick
    at the fore-edge; its top page dips into the gutter (a third of its thickness there) and rises in a curve to `lift` mm
    over the block. The top page into island `top` read the right way round, the head, tail and fore-edge into `side`
    (across its thickness), the bottom into `bottom`. mirror: the left half."""
    u = np.linspace(0.0, 1.0, nu)
    vv = np.linspace(0.0, 1.0, nv)
    ease = 1.0 - (1.0 - u) ** 2.4
    zt = z0 + t * 0.32 + (t * 0.68 + lift) * ease
    xs = u * wb * (-1 if mirror else 1)
    ys = (vv - 0.5) * hb
    T = np.array([[xs[i], ys[j], zt[i]] for i in range(nu) for j in range(nv)])
    B = np.array([[xs[i], ys[j], z0] for i in range(nu) for j in range(nv)])
    v = np.concatenate([T, B]) * MM
    ti, bi = (lambda i, j: i * nv + j), (lambda i, j: nu * nv + i * nv + j)
    it, isd, ib = I[top], I[side], I[bottom]
    a_top = (lambda i: 1 - u[i]) if mirror else (lambda i: u[i])
    F, UV = [], []
    for i in range(nu - 1):
        for j in range(nv - 1):
            F.append([ti(i, j), ti(i + 1, j), ti(i + 1, j + 1), ti(i, j + 1)])
            UV.append([it.to_uv(a_top(q), vv[r]) for q, r in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))])
            F.append([bi(i, j), bi(i, j + 1), bi(i + 1, j + 1), bi(i + 1, j)])
            UV.append([ib.to_uv(u[q], vv[r]) for q, r in ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))])
    run = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(xs), np.diff(zt)))]) / max(1e-9, np.hypot(np.diff(xs), np.diff(zt)).sum())
    for i in range(nu - 1):                                   # the head and the tail: along u, across the thickness
        F.append([ti(i, nv - 1), ti(i + 1, nv - 1), bi(i + 1, nv - 1), bi(i, nv - 1)])
        UV.append([isd.to_uv(run[i] * 0.4, 1), isd.to_uv(run[i + 1] * 0.4, 1), isd.to_uv(run[i + 1] * 0.4, 0), isd.to_uv(run[i] * 0.4, 0)])
        F.append([ti(i + 1, 0), ti(i, 0), bi(i, 0), bi(i + 1, 0)])
        UV.append([isd.to_uv(0.4 + run[i + 1] * 0.4, 1), isd.to_uv(0.4 + run[i] * 0.4, 1), isd.to_uv(0.4 + run[i] * 0.4, 0), isd.to_uv(0.4 + run[i + 1] * 0.4, 0)])
    for j in range(nv - 1):                                   # the fore-edge and the gutter's side
        i = nu - 1
        F.append([ti(i, j + 1), ti(i, j), bi(i, j), bi(i, j + 1)])
        UV.append([isd.to_uv(0.8 + vv[j + 1] * 0.2, 1), isd.to_uv(0.8 + vv[j] * 0.2, 1), isd.to_uv(0.8 + vv[j] * 0.2, 0), isd.to_uv(0.8 + vv[j + 1] * 0.2, 0)])
        F.append([ti(0, j), ti(0, j + 1), bi(0, j + 1), bi(0, j)])
        UV.append([ib.to_uv(0.5, 0.5)] * 4)
    m = M.Mesh(v, F, np.array(UV, float), mats=[it.mat])
    if mirror:
        M.flip(m)
    m.a["rest"] = m.v.copy()
    return m


def one_book(p, k, w, h, t, I, binding="left", open_at=None, lift=3.0, lite=False):
    """A book lying on its back cover (x across, y up its height, z through it from 0), its islands named with prefix p:
    closed, or open flat at `open_at` (0 to 1 of its pages turned) with its spread up."""
    K = KINDS[k]
    rb = (lambda *a, **kw: M.rbox(*a, steps=1, corner_n=2, **kw)) if lite else M.rbox     # many books: fewer rings round each edge
    ct = min(float(K["board"]), t * 0.2)
    sq = float(K["squares"])
    bev = min(ct * 0.45, 0.9) * MM
    side = -1 if binding == "left" else 1                   # the spine's side, x
    parts = []
    if open_at is None:
        bt = t - 2 * ct
        bw, bh = w - ct - sq, h - 2 * sq
        parts.append(rb((w * MM, h * MM, ct * MM), bev, I, top=p + "inside", bottom=p + "back", edge=p + "edge", at=(0, 0, 0)))
        parts.append(rb((w * MM, h * MM, ct * MM), bev, I, top=p + "front", bottom=p + "inside", edge=p + "edge", at=(0, 0, (t - ct) * MM)))
        sp = rb((t * MM, h * MM, ct * MM), bev, I, top=p + "spine", bottom=p + "inside", edge=p + "edge")
        M.turn(sp, M.rot("y", -90 if side < 0 else 90), move=(side * (w / 2 - ct) * MM, 0, t / 2 * MM))
        parts.append(sp)
        bx = side * (w / 2 - ct) - side * bw / 2
        parts.append(rb((bw * MM, bh * MM, bt * MM), 0.35 * MM, I, top="leaf", bottom="leaf", edge="pages", at=(bx * MM, 0, ct * MM)))
        if k == "diary":                                     # its elastic band round the fore-edge, its ribbon out of the tail
            xb = -side * (w / 2 - 14)
            for z0, z1 in ((-0.6, 0.0), (t, t + 0.6)):
                parts.append(M.box((8 * MM, (h + 0.4) * MM, (z1 - z0) * MM), at=(xb * MM, 0, z0 * MM), island="band", islands=I, mat="main"))
            parts.append(M.box((8 * MM, 4 * MM, 1.0 * MM), at=(xb * MM, (-h / 2 - 1.6) * MM, ct * MM), island="band", islands=I, mat="main"))
            rb = M.box((5 * MM, 38 * MM, 0.3 * MM), at=((bx + side * bw * 0.15) * MM, (-h / 2 - 12) * MM, (ct + bt * 0.55) * MM), island="band", islands=I, mat="main")
            parts.append(rb)
        return M.join(parts)
    # open flat: the covers side by side, the spine flat between them, a block of pages on each with its top page curved
    bt = t - 2 * ct
    sw = max(t * 0.9, 4.0)
    bw, bh = w - sq - ct, h - 2 * sq
    for sx, isl_out in ((-1, "front" if side < 0 else "back"), (1, "back" if side < 0 else "front")):
        parts.append(rb((w * MM, h * MM, ct * MM), bev, I, top=p + "inside", bottom=p + isl_out, edge=p + "edge", at=(sx * (sw / 2 + w / 2) * MM, 0, 0)))
    parts.append(rb((sw * MM, h * MM, ct * MM), bev, I, top=p + "inside", bottom=p + "spine", edge=p + "edge", at=(0, 0, 0)))
    turned = min(0.95, max(0.05, float(open_at)))
    tl, tr = bt * (turned if side < 0 else 1 - turned), bt * (1 - turned if side < 0 else turned)
    for sx, tb, isl in ((-1, tl, "page_l"), (1, tr, "page_r")):
        blk = curved_block(bw, bh, max(1.0, tb), ct, lift, I, isl, "pages", "leaf", mirror=sx < 0)
        blk.v[:, 0] += sx * (sw / 2) * MM
        blk.a["rest"] = blk.v.copy()
        parts.append(blk)
    return M.join(parts)


def stand(m, binding="left"):
    """A book made lying (x across, its spine at -x, or +x bound on the right; y up; z through) stood on its tail, spine
    out (-y): its thickness along x, its height up."""
    R = np.array([[0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
    if binding == "right":                                   # its spine at +x: turned round to face out too
        R = M.rot("z", 180) @ R
    return M.turn(m, R)


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "book")
    arrange = spec.get("arrange", "one")
    kind = spec.get("kind", "hardcover")
    if kind not in KINDS:
        raise ValueError(f"book kind {kind!r}: one of {', '.join(KINDS)}")
    th.material("main", "card", color="#e9e2cf", rough=0.7)
    pose = spec.get("pose", "lie")
    books = []                                               # (prefix, kind, w, h, t, art, spine, back, binding)
    titles = list(spec.get("titles") or TITLES)
    mix = list(spec.get("mix") or [kind])

    def fields(i, k, w, h):
        pal = PALETTES[int(r.integers(len(PALETTES)))]
        title = titles[(i + int(r.integers(len(titles)))) % len(titles)] if arrange != "one" else spec.get("title", (spec.get("art") or {}).get("title", titles[0]))
        author = AUTHORS[int(r.integers(len(AUTHORS)))]
        art = dict({"design": KINDS[k]["front"], "colors": pal, "title": title, "author": author}, **(spec.get("art") or {} if arrange == "one" else {}))
        if k == "textbook":
            art.setdefault("subject", SUBJECTS[(i + int(r.integers(6))) % 6])
            if arrange != "one":
                art["subject"] = SUBJECTS[(i + int(r.integers(6))) % 6]
        sp = dict({"design": "book_spine", "colors": art.get("colors", pal), "title": art.get("subject") if k == "textbook" else art.get("title", title),
                   "author": author, "gold": k in ("hardcover", "diary")}, **(spec.get("spine") or {} if arrange == "one" else {}))
        if k == "notebook":
            sp = {"design": "book_plain", "color": (art.get("colors") or ["#3a72b8"])[0]}
        if k == "diary":
            sp = {"design": "diary_cover", "colors": art.get("colors"), "part": "back"}
        bk = dict({"design": KINDS[k]["back"], "colors": art.get("colors", pal)}, **({"part": "back"} if k == "diary" else {}),
                  **(spec.get("back") or {} if arrange == "one" else {}))
        return art, sp, bk

    if arrange == "one":
        w, h = size_of(spec, kind)
        t = float(spec.get("thick", KINDS[kind]["thick"]))
        books.append(("", kind, w, h, t) + fields(0, kind, w, h) + (spec.get("binding", "left"),))
    else:
        fit = [float(v) for v in (spec.get("fit") or ([300, 220, 120] if arrange == "stack" else [400, 260, 260]))]
        want = int(spec.get("count", 0)) or 99
        used, i = 0.0, 0
        while i < want:
            k = mix[int(r.integers(len(mix)))]
            w, h = size_of({"size": spec.get("size")} if spec.get("size") else {}, k)
            t = float(spec.get("thick", KINDS[k]["thick"])) * r.uniform(0.75, 1.3)
            if arrange == "stack":                          # lying: its footprint inside the box's, as many as stand in its height
                if w > fit[0] or h > fit[1]:
                    w, h = min(w, fit[0] - 2), min(h, fit[1] - 2)
                if used + t > fit[2]:
                    break
            else:                                            # standing: its height under the box's, its width in its depth
                if h > fit[2] - 2 or w > fit[1] - 2:
                    scale = min((fit[2] - 2) / h, (fit[1] - 2) / w)
                    w, h = w * scale, h * scale
                if used + t > fit[0]:
                    break
            books.append((f"b{i}_", k, w, h, t) + fields(i, k, w, h) + (spec.get("binding", "left"),))
            used += t + (0.4 if arrange == "row" else 0.0)
            i += 1
        if not books:
            raise ValueError(f"no book fits {fit} mm")
    # islands: a single book's at full size; many books' fronts and backs smaller (only a stack's top one shows much)
    many = len(books) > 1
    for p, k, w, h, t, art, sp, bk, binding in books:
        cs = 0.45 if many else 0.3 if pose == "open" else 1.0
        th.island(p + "front", w * cs, h * cs)
        th.island(p + "back", w * cs * 0.6, h * cs * 0.6)
        th.island(p + "spine", t, h)
        th.island(p + "edge", 30, 4)
        th.island(p + "inside", w * 0.25, h * 0.25)
    maxw = max(b[2] for b in books)
    maxh = max(b[3] for b in books)
    maxt = max(b[4] for b in books)
    th.island("pages", 2 * (maxw + maxh), maxt)
    th.island("leaf", 40, 40)
    if pose == "open" and not many:
        w, h = books[0][2], books[0][3]
        th.island("page_l", w, h)
        th.island("page_r", w, h)
    if any(b[1] == "diary" for b in books):
        th.island("band", 20, 20)
    th.pack()
    I = th.islands
    parts = []
    if not many:
        p, k, w, h, t, art, sp, bk, binding = books[0]
        m = one_book(p, k, w, h, t, I, binding, open_at=float(spec.get("open_at", 0.45)) if pose == "open" else None,
                     lift=float(spec.get("lift", 3.0)))
        if pose == "stand":
            m = stand(m, binding)
        parts.append(m)
    elif arrange == "stack":
        z = 0.0
        for p, k, w, h, t, art, sp, bk, binding in books:
            m = one_book(p, k, w, h, t, I, binding, lite=True)
            yaw = r.uniform(-6, 6)
            M.turn(m, M.rot("z", yaw), move=(r.uniform(-4, 4) * MM, r.uniform(-4, 4) * MM, z * MM))
            parts.append(m)
            z += t
    else:
        x = -fit[0] / 2
        for p, k, w, h, t, art, sp, bk, binding in books:
            m = stand(one_book(p, k, w, h, t, I, binding, lite=True), binding)
            M.turn(m, np.eye(3), move=((x + t / 2) * MM, (-fit[1] / 2 + w / 2 + 3) * MM, 0))
            parts.append(m)
            x += t + 0.4
    th.low = M.join(parts)
    th.high = None
    th.pose = "stand"
    th.sharp_angle = 40
    age = float(spec.get("age", 0.2))
    pages = dict({"design": "book_pages", "age": age}, **(spec.get("pages") or {}))
    page_l = dict({"design": "page_text"}, **(spec.get("page_l") or {}))
    page_r = dict({"design": "page_text"}, **(spec.get("page_r") or {}))

    def paint(fr):
        from .. import designs
        designs.draw(fr["pages"], pages, seed + 3)
        designs.draw(fr["leaf"], {"design": "book_plain", "color": "#efe9da"}, seed + 4)
        for i, (p, k, w, h, t, art, sp, bk, binding) in enumerate(books):
            designs.draw(fr[p + "front"], art, seed + 11 * i + 1)
            designs.draw(fr[p + "back"], bk, seed + 11 * i + 2)
            designs.draw(fr[p + "spine"], sp, seed + 11 * i + 3)
            col = (art.get("colors") or ["#6d2b2b"])[0]
            designs.draw(fr[p + "edge"], {"design": "book_plain", "color": col}, seed + 11 * i + 4)
            designs.draw(fr[p + "inside"], {"design": "book_plain", "color": "#e6dcc4" if KINDS[k]["squares"] else "#efe9da"}, seed + 11 * i + 5)
        if "page_l" in fr:
            designs.draw(fr["page_l"], page_l, seed + 7)
            designs.draw(fr["page_r"], page_r, seed + 8)
        if "band" in fr:
            designs.draw(fr["band"], {"design": "book_plain", "color": "#151515"}, seed + 9)

    th.paint = paint
    return th

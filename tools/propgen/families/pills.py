"""A pill bottle: a prescription vial in tinted plastic (amber by default, any colour: `tint`; it goes out as the base
colour's factor over a near-white texture, so Godot's Albedo Color tints it again), a child-resistant cap with its
ribs and its PUSH DOWN & TURN, a sticker part way round on a material of its own (a design, `rx_label` by default, or
your own picture: `sticker: {"image": "label.png"}`), and tablets inside, dropped in and settled where they fell.

    {"family": "pills", "tint": "#c4661a", "opacity": 0.5, "cap": "#f2f2ee", "count": 24,
     "tablet": "round" | "oval" | "capsule", "tablet_color": "#f4f2ec", "tablet_color_2": "#c23b2e",
     "sticker": {"design": "rx_label", "drug": "...", ...}}
"""
import math

import numpy as np

from .. import designs
from .. import mesh as M
from .. import noise as N

R0, R1, H = 16.6, 17.1, 70.0          # the vial: radius at its foot and its lip (mm), its height
T = 1.0                                # its wall


def vial_profile():
    under = [(0, 1.2), (R0 - 2.5, 1.2), (R0 - 1.0, 0.4), (R0 - 0.3, 0.0), (R0, 0.6)]
    outside = [(R0, 0.6)] + [(R0 + (R1 - R0) * z / H, z) for z in np.linspace(4, H - 9, 6)] + [(R1, H - 6.5), (R1 + 0.6, H - 5.8), (R1 + 0.6, H - 4.6), (R1, H - 4.0), (R1, H - 0.6)]
    lip = [(R1 - T / 2 + T / 2 * math.cos(a), H - 0.6 + T / 2 * math.sin(a)) for a in np.linspace(0, math.pi, 7)]
    inside = [(R1 - T, H - 0.6)] + [(R0 - T + (R1 - R0) * z / H, z) for z in np.linspace(H - 8, 3.5, 6)] + [(R0 - T - 1.2, 2.3), (0, 2.3)]
    return {"under": under, "outside": outside, "lip": lip, "inside": inside}


CAP = [(0, 18.2), (12, 18.0), (17.6, 17.7), (19.0, 17.0), (19.4, 15.6), (19.4, 1.2), (19.0, 0.2), (18.2, 0.0), (17.9, 1.0), (17.9, 16.4)]


def tablet_profile(kind):
    """A tablet (or a capsule) turned about its own axis, mm: lying flat, its faces domed, its edge bevelled."""
    if kind == "capsule":
        r, L = 3.0, 18.0
        cap = [(r * math.sin(a), L / 2 - r + r * math.cos(a)) for a in np.linspace(0, math.pi / 2, 6)]
        # walked up from the lower tip (a lathe faces the right of its walk): the lower dome out to the side, up to the
        # middle where the two halves meet (the split), on up the side and the upper dome in to the tip
        return [(x, -y) for x, y in cap] + [(r, 0.0)] + list(reversed(cap)), L / 2
    if kind == "oval":
        r, h = 3.6, 4.2
    else:
        r, h = 4.3, 3.6
    return [(0, -h / 2), (r * 0.6, -h / 2 + 0.25), (r * 0.92, -h / 2 + 0.75), (r, -h / 2 + 1.2), (r, h / 2 - 1.2), (r * 0.92, h / 2 - 0.75),
            (r * 0.6, h / 2 - 0.25), (0, h / 2)], r


def settle(n, radius, R_in, floor, seed, steps=320):
    """Tablets dropped into the vial as balls of `radius`: gravity, the wall, the floor, each other; where they come to rest."""
    r = N.rng(seed, "pills_drop")
    a = r.uniform(0, 2 * math.pi, n)
    rr = np.sqrt(r.uniform(0, 1, n)) * (R_in - radius)
    P = np.stack([rr * np.cos(a), rr * np.sin(a), floor + radius + np.linspace(0, n * radius * 0.9, n) + r.uniform(0, radius, n)], 1)
    V = np.zeros_like(P)
    for s in range(steps):
        V[:, 2] -= 0.05
        V *= 0.92
        P += V
        for _ in range(3):
            d = P[:, None, :] - P[None, :, :]
            L = np.linalg.norm(d, axis=2) + np.eye(n) * 1e9
            push = np.clip(2 * radius - L, 0, None) / L * 0.5
            P += (d * push[..., None]).sum(1)
            P[:, 2] = np.maximum(P[:, 2], floor + radius)
            rad = np.hypot(P[:, 0], P[:, 1])
            over = rad > R_in - radius
            P[over, :2] *= ((R_in - radius) / rad[over])[:, None]
    return P


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "pills")
    tint = spec.get("tint", "#c4661a")
    kind = spec.get("tablet", "round")
    n = int(spec.get("count", 24))
    prof = vial_profile()
    th.material("vial", "clear", alpha=True, color="#f2f2f2", rough=0.08, specular=0.55)
    th.mats["vial"]["tint"] = tint
    th.material("cap", "plastic", color=spec.get("cap", "#f2f2ee"), rough=0.42, px=512)
    th.material("sticker", "paper", color="#f6f4ee", rough=0.75)
    th.material("tablet", "plastic", color=spec.get("tablet_color", "#f4f2ec"), rough=0.6, px=256)
    th.island("v_out", 2 * math.pi * R1, M.arclen(prof["outside"]), mat="vial", wrap=True)
    th.island("v_in", 2 * math.pi * R1, M.arclen(prof["inside"]), mat="vial", wrap=True)
    th.island("v_lip", 2 * math.pi * R1, M.arclen(prof["lip"]), mat="vial", wrap=True)
    th.island("v_under", 2 * R0, 2 * R0, mat="vial")
    th.island("c_top", 40, 40, mat="cap")
    th.island("c_side", 2 * math.pi * 19.4, M.arclen(CAP[3:]), mat="cap", wrap=True)
    span = math.radians(float(spec.get("sticker_span", 250)))
    s0, s1 = 12.0, 54.0
    th.island("sticker", span * (R0 + R1) / 2, s1 - s0, mat="sticker")
    th.island("sticker_back", span * (R0 + R1) / 2 * 0.3, (s1 - s0) * 0.3, mat="sticker")
    tp, tr = tablet_profile(kind)
    if kind == "capsule":
        th.island("t_a", 2 * math.pi * tr, M.arclen(tp) / 2 + 1, mat="tablet", wrap=True)
        th.island("t_b", 2 * math.pi * tr, M.arclen(tp) / 2 + 1, mat="tablet", wrap=True)
    else:
        th.island("t_a", 2 * tr, 2 * tr, mat="tablet")
        th.island("t_b", 2 * tr, 2 * tr, mat="tablet")
    th.pack()
    I = th.islands
    mm = 0.001

    def sticker(na, nz):
        """The sticker: part way round, centred on the front (-y), a hair proud of the wall; its back a little inside."""
        th_ = math.pi * 1.5 + np.linspace(-span / 2, span / 2, na)
        zs = np.linspace(s0, s1, nz)
        out = []
        for side, isl, dr in ((1, I["sticker"], 0.14), (-1, I["sticker_back"], 0.08)):
            v, f, uv = [], [], []
            for j, z in enumerate(zs):
                rad = R0 + (R1 - R0) * z / H + dr
                for i, a in enumerate(th_):
                    v.append((rad * math.cos(a), rad * math.sin(a), z))
            v = np.array(v) * mm
            for j in range(nz - 1):
                for i in range(na - 1):
                    q = [j * na + i, j * na + i + 1, (j + 1) * na + i + 1, (j + 1) * na + i]
                    f.append(q if side > 0 else q[::-1])
                    uu = np.array([i, i + 1, i + 1, i]) / (na - 1)
                    vv = np.array([j, j, j + 1, j + 1]) / (nz - 1)
                    if side < 0:
                        uu, vv = uu[::-1], vv[::-1]
                    uv.append(isl.to_uv(uu, vv))
            m = M.Mesh(v, f, np.array(uv), mats=["sticker"])
            m.a["rest"] = v.copy()
            out.append(m)
        return M.join(out)

    def build(seg):
        segs = [M.Seg(np.array(prof["under"]) * mm, "v_under", "bottom", disc=R0 * mm),
                M.Seg(np.array(prof["outside"]) * mm, "v_out", "band"),
                M.Seg(np.array(prof["lip"]) * mm, "v_lip", "band"),
                M.Seg(np.array(prof["inside"]) * mm, "v_in", "band")]
        vial = M.lathe(segs, seg, I, step=0.006, mats=["vial"])
        cap = M.lathe([M.Seg(np.array(CAP[:4]) * mm, "c_top", "top", disc=19.4 * mm),
                       M.Seg(np.array(CAP[3:]) * mm, "c_side", "band")], seg, I, step=0.004, mats=["cap"])
        M.flip(cap)     # lathed from the middle of its top outwards, its faces looked into it
        cap.v[:, 2] += (H - 6.8) * mm
        cap.a["rest"] = cap.v.copy()
        return M.join([vial, cap, sticker(max(12, seg // 2), 3)], ["vial", "cap", "sticker", "tablet"])

    low = build(int(spec.get("segments", 48)))
    # the tablets: dropped in, each where it came to rest, turned as it fell
    floor = 2.3
    pts = settle(n, tr * 0.72 if kind != "capsule" else 3.2, R0 - T - 0.3, floor, seed)
    tabs = []
    for i, p in enumerate(pts):
        half = len(tp) // 2
        maps = ("band", "band") if kind == "capsule" else ("bottom", "top")
        tm = M.lathe([M.Seg(np.array(tp[:half + 1]) * mm, "t_a", maps[0], mat="tablet", disc=tr * mm),
                      M.Seg(np.array(tp[half:]) * mm, "t_b", maps[1], mat="tablet", disc=tr * mm)], 18 if kind != "capsule" else 14, I, step=0.01,
                     mats=["tablet"])
        if kind == "oval":
            tm.v[:, 0] *= 1.65
        # lying: a flat tablet on a face (tipped a little), a capsule on its side
        ax = r.normal(0, 1, 3)
        ax /= np.linalg.norm(ax)
        ang = r.uniform(0, 0.9) if kind != "capsule" else math.pi / 2 + r.uniform(-0.6, 0.6)
        if kind == "capsule":
            ax = np.array([math.cos(r.uniform(0, 6.3)), math.sin(r.uniform(0, 6.3)), 0.0])
        K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
        Rm = np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
        tm.v = tm.v @ Rm.T + p * mm
        tm.a["rest"] = tm.v.copy() + i * 0.02
        tabs.append(tm)
    th.low = M.join([low] + tabs, ["vial", "cap", "sticker", "tablet"])
    th.high = None
    th.pose = spec.get("pose", "stand")
    th.view = {"azim": -20, "elev": 30}
    art = spec.get("sticker") or {"design": "rx_label"}

    def paint(fr):
        for nm in ("v_out", "v_in", "v_lip", "v_under"):
            f = fr[nm]
            # near white: the vial's colour is the material's tint, so it can be changed in Godot
            f.fill(color="#f4f4f4", rough=0.08, opacity=float(spec.get("opacity", 0.5)) * (1.4 if nm == "v_lip" else 1.0))
        f = fr["v_under"]
        f.text("PP 5", (f.W / 2, f.H * 0.4), 2.4, font="archivo", height=0.05, add_height=True)
        f.ring(f.W / 2, f.H / 2, 10, 0.6, height=0.08)
        capc = th.mats["cap"]["color"]
        f = fr["c_side"]
        f.fill(color=capc, rough=0.45)
        f.stripes(2.2, 0.5, angle=0, height=0.35)
        f = fr["c_top"]
        f.fill(color=capc, rough=0.4)
        c = f.W / 2
        f.ring(c, c, 14.5, 0.6, height=0.12)
        words = spec.get("cap_text", "PUSH DOWN & TURN")

        def moulded():
            f.text(words, (c, c + 10.0), 2.3, font="archivo", arc=10.0, height=0.12, add_height=True)
            f.poly([(c - 5, c - 6), (c + 3, c - 6), (c + 3, c - 7.8), (c + 6.5, c - 4.8), (c + 3, c - 1.8), (c + 3, c - 3.6), (c - 5, c - 3.6)],
                   height=0.12, add_height=True)
        f.slot("print", designs.union(designs.text_box(words, (c, c + 10.0), 2.3, font="archivo", arc=10.0), (c + 0.75, c - 4.8, 12.3, 6.8)),
               moulded, kind="text", about="PUSH DOWN & TURN and its arrow, moulded in the cap", height=0.12, add_height=True, relief=True)
        designs.draw(fr["sticker"], art, seed, "rx_label")
        designs.draw(fr["sticker_back"], {"design": "paper", "paper": "#f4f2ea"}, seed, "paper")
        c1 = spec.get("tablet_color", "#f4f2ec")
        c2 = spec.get("tablet_color_2", c1 if kind != "capsule" else "#c23b2e")
        for nm, col in (("t_a", c1), ("t_b", c2)):
            f = fr[nm]
            f.fill(color=col, rough=0.55 if kind != "capsule" else 0.25)
            if kind == "round" and nm == "t_b":
                f.rect(f.W * 0.06, f.H / 2 - 0.25, f.W * 0.88, 0.5, height=-0.3, add_height=True)

    th.paint = paint
    return th

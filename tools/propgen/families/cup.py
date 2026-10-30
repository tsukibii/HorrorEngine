"""Paper cups: the wall turned as the real cup is made (a cone of board, its rolled rim, the bottom disc set up inside
its skirt, inside and outside 0.5 mm apart), a kraft sleeve round the middle, and a lid: a hot cup's sip lid (a raised
ring, the sip spout at the front), an iced drink's flat lid with a straw through its cross, or none; then crushed.

    {"family": "cup", "size": "12oz", "lid": "sip" | "flat" | "none", "sleeve": true, "straw": true,
     "art": {"design": "coffee_cup", "brand": "...", ...}, "crush": {...}}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N

SIZES = {"8oz": (80.0, 56.0, 93.0), "12oz": (90.0, 60.0, 110.0), "16oz": (90.0, 59.0, 136.0)}   # top, bottom, height (mm)


def wall(top_d, bot_d, H, t=0.5):
    """The cup's profile (mm): outside up from the foot, round the rolled rim, inside down to the bottom disc."""
    r0, r1 = bot_d / 2, top_d / 2
    k = (r1 - r0) / H

    def r_at(z, off=0.0):
        return r0 + k * z + off
    under = [(0, 5.5), (r_at(5.5) - 1.6, 5.5), (r_at(4.8) - 0.9, 4.8), (r_at(0.8) - t, 0.6), (r_at(0.2) - 0.2, 0.0)]
    outside = [(r_at(0.0), 0.3)] + [(r_at(z), z) for z in np.linspace(2.0, H - 2.2, 8)]
    # the rim: a rolled bead of radius 1.6 on the outside of the top
    cx, cz, rb = r_at(H - 1.6) + 1.0, H - 1.6, 1.6
    bead = [(cx + rb * math.cos(a), cz + rb * math.sin(a)) for a in np.radians(np.linspace(-150, 180, 14))]
    inside = [(r_at(H - 1.0) - t, H - 1.2)] + [(r_at(z) - t, z) for z in np.linspace(H - 3.0, 7.0, 7)] + [(r_at(6.2) - t - 0.6, 6.0), (0, 6.0)]
    return {"under": under, "outside": outside, "bead": bead, "inside": inside}, r_at


def sip_lid(top_d, H):
    R = top_d / 2
    z = H - 2.0
    return [(R + 1.6, z - 5.0), (R + 1.9, z - 3.5), (R + 2.0, z - 0.5), (R + 1.6, z + 1.3), (R + 0.4, z + 2.0), (R - 1.5, z + 1.6),
            (R - 3.0, z + 1.0), (R - 4.0, z + 2.6), (R - 6.5, z + 5.6), (R - 9.0, z + 6.4), (R - 20, z + 6.2), (0, z + 6.0)]


def flat_lid(top_d, H):
    R = top_d / 2
    z = H - 2.0
    return [(R + 1.4, z - 4.0), (R + 1.7, z - 2.5), (R + 1.8, z + 0.3), (R + 1.4, z + 1.6), (R, z + 2.0), (R - 3.0, z + 1.9),
            (R - 4.0, z + 1.2), (R - 14, z + 1.0), (0, z + 1.0)]


def make(spec, th):
    top_d, bot_d, H = SIZES.get(spec.get("size", "12oz"), SIZES["12oz"])
    prof, r_at = wall(top_d, bot_d, H)
    lidk = spec.get("lid", "sip")
    sleeve = spec.get("sleeve", lidk == "sip")
    straw = spec.get("straw", lidk == "flat")
    crushed = bool(spec.get("crush"))
    th.material("main", "paper", color="#f4f2ec", rough=0.75)
    th.material("lid", "plastic", color=spec.get("lid_color", "#f6f6f4" if lidk == "sip" else "#2b2c30"), rough=0.4, px=512, double=True)
    rmid = (top_d + bot_d) / 4
    out_len = M.arclen(prof["outside"])
    th.island("print", 2 * math.pi * rmid, out_len, wrap=True)
    th.island("bead", 2 * math.pi * top_d / 2, M.arclen(prof["bead"]), wrap=True)
    th.island("inner", 2 * math.pi * rmid, M.arclen(prof["inside"]), wrap=True)
    th.island("under", bot_d, bot_d)
    if sleeve:
        th.island("sleeve", 2 * math.pi * (r_at(H * 0.5) + 1.5), H * 0.42, wrap=True)
        th.island("sleeve_in", 2 * math.pi * (r_at(H * 0.5) + 1.5), H * 0.42 + 4, wrap=True)
    if lidk != "none":
        lp = sip_lid(top_d, H) if lidk == "sip" else flat_lid(top_d, H)
        th.island("lid_top", top_d + 4, top_d + 4, mat="lid")
        th.island("lid_side", 2 * math.pi * (top_d / 2 + 2), M.arclen(lp[:4]), mat="lid", wrap=True)
    if straw:
        th.island("straw", 2 * math.pi * 3.2, 210, mat="lid", wrap=True)
    th.pack()
    I = th.islands
    mm = 0.001

    def build(n, step):
        segs = [M.Seg(np.array(prof["under"]) * mm, "under", "bottom", disc=bot_d / 2 * mm),
                M.Seg(np.array(prof["outside"]) * mm, "print", "band"),
                M.Seg(np.array(prof["bead"]) * mm, "bead", "band"),
                M.Seg(np.array(prof["inside"]) * mm, "inner", "band")]
        parts = [M.lathe(segs, n, I, step=step, mats=["main", "lid"])]
        if sleeve:
            z0, z1 = H * 0.3, H * 0.72
            o = 1.1
            sp = [(r_at(z0) + 0.2, z0), (r_at(z0) + o, z0 + 0.4)] + [(r_at(z) + o, z) for z in np.linspace(z0 + 1.0, z1 - 1.0, 6)] + \
                 [(r_at(z1) + o, z1 - 0.4), (r_at(z1) + 0.2, z1)]
            parts.append(M.lathe([M.Seg(np.array(sp) * mm, "sleeve", "band")], n, I, step=step, mats=["main"]))
        if lidk != "none":
            lp = sip_lid(top_d, H) if lidk == "sip" else flat_lid(top_d, H)
            lid = M.lathe([M.Seg(np.array(lp[:4]) * mm, "lid_side", "band"), M.Seg(np.array(lp[3:]) * mm, "lid_top", "top",
                                                                                    disc=(top_d / 2 + 2) * mm)], n, I, step=step, mats=["lid"])
            if lidk == "sip":
                # the spout: a raised oval at the front with its slot
                p = lid.a["rest"] / mm
                d = ((p[:, 0] / 9.0) ** 2 + ((p[:, 1] + (top_d / 2 - 8.5)) / 5.0) ** 2)
                lid.v[:, 2] += np.where(p[:, 2] > H, 2.6 * mm * np.exp(-d ** 2 * 1.5), 0)
            parts.append(lid)
        if straw:
            L, r = 205.0, 3.2
            sp = [(0, 0), (r * 0.6, 0), (r, 0.6)] + [(r, z) for z in np.linspace(2, L - 2, 10)] + [(r, L - 0.6), (r * 0.6, L), (0, L)]
            st = M.lathe([M.Seg(np.array(sp) * mm, "straw", "band")], 16, I, step=step * 3, mats=["lid"])
            # through the lid's cross, leaning back (along the cup when it's dropped: it lies on its side, not its straw)
            ang = math.radians(float(spec.get("straw_lean", 0 if spec.get("pose") == "lie" else 12)))
            c, s = math.cos(ang), math.sin(ang)
            v = st.v.copy()
            v[:, 2] -= 0.55 * L * mm
            y, z = v[:, 1] * c - v[:, 2] * s, v[:, 1] * s + v[:, 2] * c
            v[:, 1], v[:, 2] = y + (4 if ang else 0) * mm, z + (H + 0.55 * L * math.cos(ang) - 40) * mm
            st.v = v
            st.a["rest"] = v.copy()
            th_s = np.arctan2(v[:, 1], v[:, 0])
            st.a["shell"] = np.stack([th_s, v[:, 2], np.hypot(v[:, 0], v[:, 1])], 1)
            parts.append(st)
        return M.join(parts, ["main", "lid"])

    if crushed:
        th.low = build(int(spec.get("segments", 56)), 0.004)
        th.high = build(144, 0.0014)
    else:
        th.low = build(int(spec.get("segments", 48)), 0.01)
        th.high = None
    seed = int(spec.get("seed", 0))
    c = spec.get("crush")
    for m in (th.low, th.high):
        if m is None or not c:
            continue
        D.crush(m, amount=c.get("amount", 0.8), at=c.get("at", 0.5), spread=c.get("spread", 0.5), squash=c.get("squash", 0),
                twist=c.get("twist", 8), buckle=c.get("buckle", 0.5), wrinkle=c.get("wrinkle", 0.4), shorten=c.get("shorten", 0.06),
                bend=c.get("bend", 0), rigid=(0.0, 0.98), thin=c.get("thin", 0.12), seed=c.get("seed", seed), z_range=(0.0, H * mm))
        z = m.a["rest"][:, 2] / (H * mm)
        D.displace(m, 1.2 * mm, 18 * mm, seed + 4, ridged=True, mask=N.smoothstep(0.05, 0.2, z) * (1 - N.smoothstep(0.85, 0.97, z)))
    th.pose = "lie" if crushed or spec.get("pose") == "lie" else "stand"
    art = spec.get("art") or {"design": "coffee_cup"}

    def paint(fr):
        designs.draw(fr["print"], art, seed, "coffee_cup")
        fr["bead"].fill(color="#f7f5f0", rough=0.6)
        f = fr["inner"]
        f.fill(color="#f1efe8", rough=0.55)
        if art.get("stain", lidk == "sip"):
            f.gradient("#6b4a2c", "#f1efe8", angle=90, t0=0.0, t1=0.25, rough=0.4, alpha=0.6)
        fr["under"].fill(color="#ebe8e0", rough=0.8)
        fr["under"].ring(bot_d / 2, bot_d / 2, bot_d * 0.42, 0.8, height=0.1)
        if sleeve:
            designs.draw(fr["sleeve"], dict(art, design=art.get("sleeve_design", "sleeve")), seed + 1, "sleeve")
            fr["sleeve_in"].fill(color="#b98e5c", rough=0.9)
        if lidk != "none":
            f = fr["lid_top"]
            lc = th.mats["lid"]["color"]
            f.fill(color=lc, rough=0.38)
            cx = f.W / 2
            if lidk == "sip":
                f.ellipse(cx, cx - (top_d / 2 - 8.5), 4.2, 1.3, color="#1c1c1c", rough=0.6, height=-0.4)
                f.ring(cx, cx, top_d / 2 - 3.5, 0.4, height=0.1)
            else:
                f.line([(cx - 4, cx - 4), (cx + 4, cx + 4)], 0.5, color="#111111", height=-0.2)
                f.line([(cx - 4, cx + 4), (cx + 4, cx - 4)], 0.5, color="#111111", height=-0.2)
                f.text("PS 6", (cx, cx - 20), 2.2, font="archivo", height=0.06, add_height=True)
            fr["lid_side"].fill(color=lc, rough=0.42)
        if straw:
            f = fr["straw"]
            f.fill(color="#ffffff", rough=0.35)
            f.stripes(6.0, 0.5, angle=35, color=spec.get("straw_color", "#d8262e"), rough=0.35)

    th.paint = paint
    th.view = {"azim": -12} if not crushed else {}
    return th

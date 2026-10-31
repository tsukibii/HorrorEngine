"""Small kitchen appliances with their print: a rice cooker (a modern IH one: a soft body, its domed lid, a black glass
panel with the LCD, the button legends and the cook and warm lights, its steam vent; or a 1980s one in cream with a
flowered band and a lever) and an electric jug kettle (brushed steel or white, its base with the cord, the D handle
with its switch and light, the water window with its marks, the spout). Brands made up. Sockets as the kit's: a rice
cooker's lcd, led_warm, led_cook, vent, button; a kettle's spout, lid, switch, led, base.

    {"family": "appliance", "kind": "rice_cooker" | "kettle", "style": "modern" | "retro" (rice cooker),
     "finish": "steel" | "white" (kettle), "color": "#f3f1ec", "accent": "#e07a1f", "time": "12:30",
     "brand": "HONOKA", "brand_font": "bungee", "brand_color": "#2a2c2e" or "logo": {"image": "my_logo.png", "w": 50}}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

MM = 0.001
UI = dict(rough=0.25, height=0.0)


def brand_mark(f, spec, at, size, color, width):
    """The maker's mark at `at` (mm on the island): your own picture (`logo`: a PNG path from the project folder, or
    {"image": path, "w": its width in mm, "rough": 0.3}; its alpha cuts it out, its height kept to its width), or else
    the name (`brand`) in a font (`brand_font`, any of paint.FONT_FILES or a .ttf path) and a colour (`brand_color`)."""
    from .. import paint as P
    logo = spec.get("logo")
    if logo:
        lg = logo if isinstance(logo, dict) else {"image": logo}
        img = P.read_image(lg["image"])
        w = float(lg.get("w", width))
        h = w * img.shape[0] / img.shape[1]
        f.image(img, at[0] - w / 2, at[1] - h / 2, w, h, rough=float(lg.get("rough", 0.3)), height=0.01)
        return
    f.text(spec.get("brand", "HONOKA"), at, size, font=spec.get("brand_font", "archivo"), tracking=0.16 if "brand_font" not in spec else 0.0,
           color=spec.get("brand_color", color), rough=0.3, height=0.02)


def _plastic(f, color, rough=0.3, seed=0, tex=0.004):
    """Moulded plastic: its colour, a faint texture in the relief."""
    f.fill(color=color, rough=rough, metal=0.0)
    X, Y = f.grid()
    g = N.fbm3(np.stack([X / 0.4, Y / 0.4, np.full_like(X, seed)], -1), seed, 2)
    f.lay_island(np.ones_like(X), height=(g * tex).astype(np.float32))


def _segments(f, s, x, y, h, color, off="#9aa89a"):
    """Seven-segment digits (and a colon) h mm tall from (x, y) its bottom left; the dark segments faint."""
    SEG = {"0": "abcfed", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgecd", "7": "abc", "8": "abcdefg",
           "9": "abcdfg", " ": ""}
    w = h * 0.55
    t = h * 0.12
    cx = x
    for ch in s:
        if ch == ":":
            for yy in (y + h * 0.3, y + h * 0.7):
                f.rect(cx + w * 0.1, yy - t / 2, t, t, color=color, **UI)
            cx += w * 0.45
            continue
        on = SEG.get(ch, "")
        segs = {"a": (cx + t, y + h - t, w - 2 * t, t), "g": (cx + t, y + h / 2 - t / 2, w - 2 * t, t), "d": (cx + t, y, w - 2 * t, t),
                "f": (cx, y + h / 2, t, h / 2 - t * 0.5), "b": (cx + w - t, y + h / 2, t, h / 2 - t * 0.5), "e": (cx, y + t * 0.5, t, h / 2 - t * 0.5),
                "c": (cx + w - t, y + t * 0.5, t, h / 2 - t * 0.5)}
        for k, (sx, sy, sw, sh) in segs.items():
            f.rect(sx, sy, sw, sh, r=t * 0.3, color=color if k in on else off, alpha=1.0 if k in on else 0.35, **UI)
        cx += w * 1.3


def rice_cooker(spec, th):
    seed = int(spec.get("seed", 0))
    retro = spec.get("style", "modern") == "retro"
    body_c = spec.get("color", "#efe6d0" if retro else "#f3f1ec")
    accent = spec.get("accent", "#c8531e" if retro else "#e07a1f")
    W, D, Hb = 252.0, 322.0, 192.0
    th.material("main", "plastic", color=body_c, rough=0.3)
    th.material("panel", "plastic", color="#16161a", rough=0.12, px=1024)
    th.island("b_top", W, D)
    th.island("b_bot", W * 0.5, D * 0.5)
    th.island("b_side", M.rperim(W, D, 76), Hb + 20, wrap=True)
    th.island("l_top", W, D)
    th.island("l_bot", W * 0.4, D * 0.4)
    th.island("l_side", M.rperim(W - 8, D - 70, 70), 50, wrap=True)
    th.island("panel", 170, 60, mat="panel")
    th.island("panel_b", 85, 30, mat="panel")
    th.island("panel_e", 2 * (170 + 60), 8, mat="panel", wrap=True)
    th.island("vent", 2 * math.pi * 26, 30)
    th.island("vent_top", 52, 52)
    th.island("release", 120, 30)
    th.island("release_e", 160, 14, wrap=True)
    th.island("feet", 2 * math.pi * 12, 12, wrap=True)
    th.island("cord", 2 * math.pi * 3.5, 400, wrap=True)
    th.pack()
    I = th.islands
    z0 = 6.0
    parts = [M.rbox((W * MM, D * MM, Hb * MM), 16 * MM, I, "b_top", "b_bot", "b_side", at=(0, 0, z0 * MM), corner=76 * MM, fill=40 * MM, step=30 * MM)]
    Dl = D - 70
    lid = M.rbox(((W - 8) * MM, Dl * MM, 30 * MM), 14 * MM, I, "l_top", "l_bot", "l_side", at=(0, 26 * MM, (z0 + Hb - 14) * MM), corner=70 * MM,
                 fill=24 * MM, step=10 * MM)
    p = lid.v[:, :2] / MM - (0, 26)
    top = lid.v[:, 2] > (z0 + Hb + 2) * MM
    dome = 14 * np.clip(1 - (p[:, 0] / ((W - 8) / 2)) ** 2, 0, 1) * np.clip(1 - (p[:, 1] / (Dl / 2)) ** 2, 0, 1)
    lid.v[:, 2] += np.where(top, dome, 0) * MM
    lid.a["rest"] = lid.v.copy()
    parts.append(lid)
    # the panel: black glass on the deck in front of the lid, tipped toward whoever stands there
    pz = z0 + Hb + 1.0
    py = -D / 2 + 36
    pn = M.rbox((170 * MM, 60 * MM, 4 * MM), 1.6 * MM, I, "panel", "panel_b", "panel_e", at=(0, 0, -2 * MM), corner=8 * MM, fill=12 * MM)
    M.turn(pn, M.rot("x", 16), move=(0, py * MM, (pz + 2) * MM))
    parts.append(pn)
    # the lid's release, the steam vent
    rl = M.rbox((60 * MM, 16 * MM, 12 * MM), 5 * MM, I, "release", "release", "release_e", at=(0, (26 - Dl / 2 + 8) * MM, (z0 + Hb + 12) * MM),
                corner=7 * MM, fill=10 * MM)
    parts.append(rl)
    vz = z0 + Hb + 16 + 12
    vm = M.lathe([M.Seg(np.array([(26, 0), (26.4, 4), (25, 8.6), (21, 10.4)]) * MM, "vent", "band"),
                  M.Seg(np.array([(21, 10.4), (0, 11)]) * MM, "vent_top", "top", disc=26 * MM)], 40, I, step=0.004)
    vm.v[:, 2] += (vz - 4) * MM
    vm.v[:, 1] += 86 * MM
    vm.a["rest"] = vm.v.copy()
    parts.append(vm)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ft = M.lathe([M.Seg(np.array([(0, 0), (10, 0), (12, 2), (12, 6.5), (0, 6.5)]) * MM, "feet", "band")], 16, I, step=0.004)
            ft.v += np.array([sx * 80, sy * 110, 0]) * MM
            ft.a["rest"] = ft.v.copy()
            parts.append(ft)
    cp = M.spline([(0, D / 2 - 6, 40), (0, D / 2 + 30, 30), (20, D / 2 + 70, 6), (70, D / 2 + 110, 3.5), (140, D / 2 + 130, 3.5)], 10)
    parts.append(M.tube(np.array(cp) * MM, 3.5 * MM, I["cord"], n=8, caps=(False, True), cap_bulge=0.6))
    th.low = M.join(parts, ["main", "panel"])
    th.high = None
    th.weighted = 50
    th.pose = "stand"
    th.view = {"azim": -24, "elev": 30}
    # the panel's things in the item's own space: a cap maps over 90% of its island, then through the panel's tilt
    Rp = M.rot("x", 16)
    nrm = tuple(Rp @ np.array([0.0, 0.0, 1.0]))

    def on_panel(X, Y):
        return (Rp @ np.array([X / 0.9, Y / 0.9, 2.2]) + np.array([0, py, pz + 2])) * MM

    th.sockets["lcd"] = (on_panel(0, 10), nrm)
    th.sockets["led_cook"] = (on_panel(62, 4), nrm)
    th.sockets["led_warm"] = (on_panel(-62, 4), nrm)
    th.sockets["button"] = (on_panel(62, -19), nrm)
    th.sockets["vent"] = (np.array([0, 86, vz + 7]) * MM, (0, 0, 1))
    now = spec.get("time", "12:30")

    def paint(fr):
        for nm in ("b_top", "b_bot", "b_side", "l_top", "l_bot", "l_side", "vent", "vent_top", "release", "release_e"):
            _plastic(fr[nm], body_c, rough=0.28, seed=seed + len(nm))
        for nm in ("feet", "cord"):
            _plastic(fr[nm], "#1c1c1c" if nm == "feet" else "#e8e6e0" if not retro else "#3a3632", rough=0.6, seed=seed)
        f = fr["b_side"]
        if retro:
            # the flowered band round its middle: brown and orange blossoms on a cream ground, a stripe above and below
            band_y = Hb * 0.42
            f.rect(0, band_y - 26, f.W, 1.6, color="#7a4a24", rough=0.3)
            f.rect(0, band_y + 26, f.W, 1.6, color="#7a4a24", rough=0.3)
            rng = N.rng(seed, "flowers")
            x = 0.0
            while x < f.W:
                cx, cy = x + rng.uniform(-4, 4), band_y + rng.uniform(-8, 8)
                R = rng.uniform(8, 13)
                col = ["#c8531e", "#7a4a24", "#d9a03a"][int(rng.integers(3))]
                for k in range(5):
                    a = 2 * math.pi * k / 5 + rng.uniform(0, 1)
                    f.ellipse(cx + math.cos(a) * R * 0.6, cy + math.sin(a) * R * 0.6, R * 0.5, R * 0.32, rot=math.degrees(a), color=col, rough=0.3)
                f.ellipse(cx, cy, R * 0.28, color="#f3e7c8", rough=0.3)
                f.ellipse(cx + R * 1.3, cy - R * 0.6, R * 0.55, R * 0.2, rot=-30, color="#5a6a2a", rough=0.3)
                x += R * 3.2
        f = fr["l_top"]
        brand_mark(f, spec, (f.W / 2, f.H * 0.2), 9, "#8a8680" if not retro else "#7a4a24", 64)
        if not retro:
            f.text("IH", (f.W / 2, f.H * 0.12), 5, font="archivo", color=accent, rough=0.3)
            f.ellipse(f.W / 2, f.H * 0.82, 30, 18, color=designs.P.mix(designs.P.rgb(body_c), "#000000", 0.05), rough=0.25)
        else:
            f.text("電子炊飯ジャー", (f.W / 2, f.H * 0.1), 5.5, font="gothic_jp", color="#7a4a24", rough=0.3)
        f = fr["b_side"]
        front = f.W - (W / 2 - 76)                      # the band starts at the front's right end: its middle is near the end
        f.text("5.5合" if not retro else "1.0L", (front - 34, Hb * 0.14), 6, font="gothic_jp", color="#9a968e", rough=0.3, height=0.01)
        # the panel
        f = fr["panel"]
        f.fill(color="#121216", rough=0.08)
        if retro:
            f.fill(color=body_c, rough=0.28)
            f.rect(f.W / 2 - 34, f.H / 2 - 13, 68, 26, r=6, color="#3a3632", rough=0.35, height=0.6)
            f.text("炊飯", (f.W / 2, f.H / 2), 9, font="gothic_jp", color="#f3e7c8", rough=0.3, height=0.02)
            f.ellipse(f.W / 2 - 58, f.H / 2, 4, color="#b0221a", rough=0.15, height=0.4)
            f.text("保温", (f.W / 2 - 58, f.H / 2 - 10), 4.2, font="gothic_jp", color="#7a4a24", rough=0.3)
            f.ellipse(f.W / 2 + 58, f.H / 2, 4, color="#e0a020", rough=0.15, height=0.4)
            f.text("炊飯", (f.W / 2 + 58, f.H / 2 - 10), 4.2, font="gothic_jp", color="#7a4a24", rough=0.3)
        else:
            lcd = (f.W / 2 - 30, f.H / 2 - 2, 60, 24)
            f.rect(*lcd, r=2, color="#a9b8a4", rough=0.18)
            _segments(f, now, lcd[0] + 12, lcd[1] + 5, 13, "#1a201a")
            for i, w in enumerate(("白米", "無洗米", "玄米", "炊込")):
                f.text(w, (lcd[0] + 6 + i * 16, lcd[1] + 20.5), 2.6, font="gothic_jp", color="#1a201a" if i == 0 else "#7a887a", rough=0.18)
            f.text("予約", (lcd[0] + 6, lcd[1] + 2.6), 2.4, font="gothic_jp", color="#7a887a", rough=0.18)
            btn = dict(color="#2a2a30", rough=0.2, height=0.5)
            for x, w in ((f.W / 2 - 62, "保温/切"), (f.W / 2 - 40, "メニュー"), (f.W / 2 + 40, "予約"), (f.W / 2 - 15, "時"), (f.W / 2 + 15, "分")):
                yb = f.H / 2 - 16 if w in ("時", "分") else f.H / 2 - 22
                if w in ("時", "分"):
                    f.ellipse(x, yb, 5, **btn)
                else:
                    f.rect(x - 9.5, yb - 5, 19, 10, r=4, **btn)
                f.text(w, (x, yb), 2.8, font="gothic_jp", color="#e8e8e8", rough=0.2)
            f.rect(f.W / 2 + 62 - 13, f.H / 2 - 30, 26, 22, r=6, color=accent, rough=0.25, height=0.6)
            f.text("炊飯", (f.W / 2 + 62, f.H / 2 - 19), 4.5, font="gothic_jp", color="#ffffff", rough=0.25)
            for x, c in ((-62, "#e8a030"), (62, "#d03020")):
                f.ellipse(f.W / 2 + x, f.H / 2 + 4, 1.6, color=c, rough=0.1, height=0.2)
            f.text("保温", (f.W / 2 - 62, f.H / 2 + 9), 2.6, font="gothic_jp", color="#c8c8c8", rough=0.2)
            f.text("炊飯", (f.W / 2 + 62, f.H / 2 + 9), 2.6, font="gothic_jp", color="#c8c8c8", rough=0.2)
        fr["panel_b"].fill(color="#121216", rough=0.3)
        fr["panel_e"].fill(color="#0e0e10", rough=0.2)
        f = fr["vent_top"]
        for k in range(5):
            f.rect(f.W / 2 - 14, f.H / 2 - 10 + k * 5, 28, 1.6, r=0.8, color="#3a3836", rough=0.6, height=-0.6, add_height=True)
        f = fr["release"]
        f.text("PUSH" if not retro else "▼", (f.W / 2, f.H / 2), 3.4, font="archivo", color="#8a8680", rough=0.3)

    th.paint = paint
    return th


def kettle(spec, th):
    seed = int(spec.get("seed", 0))
    fin = spec.get("finish", "steel")
    steel = fin == "steel"
    color = spec.get("color", "#c6c9cc" if steel else "#f2f1ee")
    th.material("main", "steel" if steel else "plastic", color=color, rough=0.25 if steel else 0.25, metal=1.0 if steel else 0.0)
    th.material("trim", "plastic", color="#1a1a1c", rough=0.35, px=1024)
    prof = [(0, 17), (70, 17), (73.5, 19.5), (74.2, 24), (71, 110), (66.5, 196), (65, 204), (63, 208), (61, 209.5)]
    lidp = [(61, 209.5), (61.5, 212.5), (58, 215.5), (34, 218.6), (0, 219.4)]
    basep = [(0, 0), (78, 0), (82, 2.5), (82.4, 11), (80, 15.5), (74, 17), (0, 17)]
    th.island("bottom", 140, 140)
    th.island("body", 2 * math.pi * 74, M.arclen(prof[1:]), wrap=True)
    th.island("lid", 2 * math.pi * 62, M.arclen(lidp), mat="trim", wrap=True)
    th.island("base", 2 * math.pi * 82.5, M.arclen(basep[1:]), mat="trim", wrap=True)
    th.island("base_bot", 165, 165, mat="trim")
    th.island("handle", 2 * math.pi * 12, 330, mat="trim", wrap=True)
    th.island("spout", 2 * math.pi * 14, 50, wrap=True)
    th.island("switch", 40, 26, mat="trim")
    th.island("switch_e", 70, 10, mat="trim", wrap=True)
    th.island("cord", 2 * math.pi * 3.2, 300, mat="trim", wrap=True)
    th.pack()
    I = th.islands
    parts = [M.lathe([M.Seg(np.array(basep[:2]) * MM, "base_bot", "bottom", disc=82 * MM), M.Seg(np.array(basep[1:]) * MM, "base", "band", mat="trim")],
                     56, I, step=0.012, mats=["trim"])]
    body = M.lathe([M.Seg(np.array(prof[:2]) * MM, "bottom", "bottom", disc=70 * MM), M.Seg(M.spline(prof[1:], 6) * MM, "body", "band")], 56, I,
                   step=0.02, mats=["main"])
    parts.append(body)
    parts.append(M.lathe([M.Seg(M.spline(lidp, 3) * MM, "lid", "band", mat="trim")], 56, I, step=0.01, mats=["trim"]))
    # the spout: a beak out of the front of the rim
    sp = M.spline([(0, -52, 182), (0, -66, 196), (0, -80, 207), (0, -90, 212)], 4)
    t = np.linspace(0, 1, len(sp))
    spm = M.tube(sp * MM, np.interp(t, [0, 1], [17, 10]) * MM, I["spout"], n=16, caps=(False, False))
    ring = spm.v.reshape(len(sp), 16, 3)
    ctr = sp[:, None] * MM
    ring[:] = ctr + (ring - ctr) * np.array([1.0, 1.0, 0.55])
    spm.v = ring.reshape(-1, 3)
    spm.a["rest"] = spm.v.copy()
    parts.append(spm)
    # the handle: a D at the back, its switch at the foot, the lid's button at the top
    hp = M.spline([(0, 60, 196), (0, 92, 202), (0, 112, 186), (0, 116, 140), (0, 110, 82), (0, 96, 52), (0, 70, 42)], 8)
    a = np.linspace(0, 2 * math.pi, 16, endpoint=False)
    sec = np.stack([13 * np.cos(a), 10 * np.sin(a)], 1) * MM
    parts.append(M.sweep(np.array(hp) * MM, sec, I["handle"], mat="trim"))
    sw = M.rbox((18 * MM, 13 * MM, 9 * MM), 3 * MM, I, "switch", "switch", "switch_e", at=(0, 0, -4.5 * MM), corner=4 * MM, mat="trim")
    M.turn(sw, M.rot("x", -70), move=(0, 118 * MM, 76 * MM))
    parts.append(sw)
    cp = M.spline([(0, 72, 6), (0, 96, 5), (30, 140, 3.2), (90, 170, 3.2)], 10)
    parts.append(M.tube(np.array(cp) * MM, 3.2 * MM, I["cord"], n=8, caps=(False, True)))
    th.low = M.join(parts, ["main", "trim"])
    th.high = None
    th.weighted = 50
    th.pose = "stand"
    th.view = {"azim": -32, "elev": 20}
    tipd = (sp[-1] - sp[-2]) / np.linalg.norm(sp[-1] - sp[-2])
    th.sockets["spout"] = ((sp[-1] + tipd * 3) * MM, tuple(tipd))
    th.sockets["lid"] = (np.array([0, 0, 222]) * MM, (0, 0, 1))
    th.sockets["switch"] = (np.array([0, 122, 78]) * MM, (0, 0.94, 0.34))
    th.sockets["led"] = (np.array([0, 121, 71]) * MM, (0, 0.94, 0.34))
    th.sockets["base"] = (np.array([0, 0, 0]) * MM, (0, 0, 1))

    def paint(fr):
        f = fr["body"]
        if steel:
            FN.metal(f, "brushed", color, seed + 1, along=90)
        else:
            _plastic(f, color, rough=0.22, seed=seed)
        FN.metal(fr["bottom"], "satin", "steel", seed + 2)
        # the water window down the front right, its marks; the brand on the front
        wx = f.W * 0.36
        f.rect(wx - 7, 34, 14, 120, r=6, color="#5a6a78", rough=0.06, metal=0.0, height=0.4)
        f.rect(wx - 5.5, 36, 11, 116, r=5, color="#8fa6b8", rough=0.05, alpha=0.6)
        for k, (yy, lab) in enumerate(((140, "MAX 1.7L"), (110, "1.2"), (80, "0.8"), (52, "MIN"))):
            f.rect(wx - 5, yy, 10, 0.8, color="#f4f4f4", rough=0.2)
            f.text(lab, (wx + 9, yy + 0.4), 3.0, font="archivo", anchor="left", color="#2a2a2a" if not steel else "#3a3c3e", rough=0.3)
        brand_mark(f, spec, (f.W * 0.5, 120), 7, "#2a2c2e" if steel else "#9a968e", 40)
        for nm in ("lid", "base", "base_bot", "handle", "switch_e", "cord"):
            _plastic(fr[nm], "#1a1a1c", rough=0.35 if nm != "base_bot" else 0.6, seed=seed + len(nm))
        f = fr["base_bot"]
        for k in range(3):
            f.ring(f.W / 2, f.H / 2, 30 + k * 18, 1.2, color="#2a2a2c", rough=0.6, height=0.4)
        f.text("220-240V~ 50/60Hz 2200W", (f.W / 2, f.H / 2 - 12), 3, font="archivo", color="#4a4a4c", rough=0.6)
        f = fr["lid"]
        f.ellipse(f.W * 0.0 + 6, f.H * 0.7, 5, color="#2a2a2c", rough=0.3, height=0.3)
        f = fr["switch"]
        _plastic(f, "#1a1a1c", rough=0.35, seed=seed)
        f.text("I", (f.W * 0.3, f.H / 2), 6, font="archivo", color="#e8e8e8", rough=0.3)
        f.text("O", (f.W * 0.7, f.H / 2), 6, font="archivo", color="#e8e8e8", rough=0.3)
        f.ellipse(f.W * 0.5, f.H * 0.18, 1.8, color="#3a7fd0", rough=0.1)
        if steel:
            FN.metal(fr["spout"], "brushed", color, seed + 3)
        else:
            _plastic(fr["spout"], color, rough=0.22, seed=seed)

    th.paint = paint
    return th


def make(spec, th):
    return kettle(spec, th) if spec.get("kind") == "kettle" else rice_cooker(spec, th)

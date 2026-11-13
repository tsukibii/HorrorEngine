# profile.py [name]: a picture seen from the side as a reference: its traced outline and what it measures.
# MediaPipe finds no face in a profile (lm.py: "no face"), so a side picture's reference is traced: the silhouette from
# the forehead to the chin (found row by row where the skin's colour begins, looked at enlarged and set right by hand
# where the background is skin-coloured), the jaw's lower edge (column by column, where the brightness falls to the
# neck's shadow), and a few points put by hand on an enlargement (the eye, the ear). All in the source picture's
# pixels. Writes out/<name>_profile.json (what profit.mjs fits a head to) and out/<name>_ref.jpg (the picture enlarged
# with the trace and the measures on it: the thing to look at beside ours), and prints the measures: lengths as shares
# of the face's height (nasion to menton), angles in degrees, none of them changed by how the head is tipped in the
# picture's plane.
import sys, os, json, math
from PIL import Image, ImageDraw
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..") + "/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + "/"
PROFILES = {
    # the user's second picture (DECISIONS 2026-11-13, two heads): her left side, the head tipped back about 20 degrees
    "h2": {
        "file": R + "Saved/Heads/ref/h2.png", "faces": "left",       # the nose points to the picture's left
        # forehead (under the fringe from y 78 up: only its lowest 2 cm show), nasion, the nose's bridge, tip and
        # underside, the upper lip, [the mouth, parted], the lower lip, the fold under it, the chin's front and bottom
        "silhouette": [(38, 72), (36.5, 76), (36.5, 80), (37.5, 84), (39.5, 88), (40, 92), (39, 96), (37, 100), (34, 104), (30.5, 107), (27, 110), (23.5, 113),
                       (20.5, 116), (17.5, 120), (15, 124), (13.5, 128), (14, 131), (16.5, 134.5), (19.5, 138.5), (20.5, 142), (20.5, 145), (19.5, 148),
                       (18.5, 151), (19.5, 154), (22, 157), None, (22, 163), (20.5, 166), (20.5, 169), (22.5, 172), (24, 175), (24.5, 180), (24, 185),
                       (24, 190), (24.5, 194), (26, 197), (29, 200)],
        # the jaw's lower edge from the chin back toward its angle (a strand of hair crosses it at x 50 to 64; behind
        # x 104 the wisps in front of the ear hide it)
        "jaw": [(30, 199.5), (34, 200), (38, 200.5), (42, 201), (46, 201.5), (66, 201), (70, 199.5), (74, 197.5), (78, 195.5), (82, 193.5), (86, 192), (90, 190.5),
                (94, 189), (98, 187.5), (102, 186)],
        "points": {
            "nasion": (40, 92), "tip": (13.5, 128.5), "subnasale": (19.5, 138.5), "upper_lip": (18.5, 151), "stomion": (24, 160), "lower_lip": (20.5, 167.5),
            "fold": (24.5, 177), "pogonion": (24, 188), "menton": (31, 200.5),
            "eye_front": (57.5, 97), "eye_outer": (80, 100), "eye_top": (66, 89.5), "eye_bottom": (68, 104.5), "iris": (64.5, 97),
            "ear_top": (181, 120), "ear_back": (194.5, 142), "ear_lobe": (153, 171.5), "tragus": (158, 150), "ear_front_top": (163, 127),
        },
    },
}
def ang(a, b, c):                                        # the angle at b between b->a and b->c, degrees
    u = (a[0] - b[0], a[1] - b[1]); v = (c[0] - b[0], c[1] - b[1])
    return math.degrees(math.acos(max(-1, min(1, (u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v))))))
def off(p, a, b):                                        # how far p is from the line a->b, + toward the face's front (the left of a->b going down the picture when she faces left)
    d = (b[0] - a[0], b[1] - a[1]); n = math.hypot(*d)
    return ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / n
def measures(P, jaw, faces="left"):
    """the profile's proportions from its points: lengths over the face's height (nasion to menton), angles in degrees.
    Used on the picture's trace and on our head's same points (profit.mjs writes them), so the two tables compare"""
    s = -1 if faces == "left" else 1; d = lambda a, b: math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]); H = d("nasion", "menton")
    o = lambda p, a, b: s * off(P[p], P[a], P[b]) / H
    P = dict(P); P["ear_mid"] = ((P["ear_top"][0] + P["ear_lobe"][0]) / 2, (P["ear_top"][1] + P["ear_lobe"][1]) / 2)
    jl = [jaw[0], jaw[-1]]; fh = (P["ear_mid"][0] - P["eye_bottom"][0], P["ear_mid"][1] - P["eye_bottom"][1])   # (the eye's lower lid to the ear's middle: the head's own level line, whatever way it's tipped)
    jd = (jl[1][0] - jl[0][0], jl[1][1] - jl[0][1])
    return {
        "nose length (nasion to tip)": d("nasion", "tip") / H,
        "nose projection (tip off nasion-upper lip)": o("tip", "nasion", "upper_lip"),
        "tip to upper lip": d("tip", "upper_lip") / H,
        "nasion to the mouth": d("nasion", "stomion") / H,
        "chin (the mouth to menton)": d("stomion", "menton") / H,
        "upper lip off tip-pogonion (E line)": o("upper_lip", "tip", "pogonion"),
        "lower lip off tip-pogonion (E line)": o("lower_lip", "tip", "pogonion"),
        "pogonion off nasion-upper lip": o("pogonion", "nasion", "upper_lip"),
        "fold depth (off lower lip-pogonion)": o("fold", "lower_lip", "pogonion"),
        "eye height": d("eye_top", "eye_bottom") / H,
        "eye front behind nasion": d("eye_front", "nasion") / H,
        "ear height (top to lobe)": d("ear_top", "ear_lobe") / H,
        "ear behind nasion": d("ear_mid", "nasion") / H,
        "ear behind eye's outer corner": d("ear_mid", "eye_outer") / H,
        "ear's back behind its middle": d("ear_back", "ear_mid") / H,
        "nasofrontal angle (forehead, nasion, tip)": ang(P["forehead"], P["nasion"], P["tip"]) if "forehead" in P else float("nan"),
        "nose tip angle (nasion, tip, upper lip)": ang(P["nasion"], P["tip"], P["upper_lip"]),
        "facial angle (nasion-pogonion against eye-ear)": ang((P["nasion"][0] + fh[0], P["nasion"][1] + fh[1]), P["nasion"], P["pogonion"]),
        "jaw line against eye-ear": math.degrees(math.atan2(fh[0] * jd[1] - fh[1] * jd[0], fh[0] * jd[0] + fh[1] * jd[1])) * -s,
        "ear's axis against eye-ear": ang((P["ear_lobe"][0] + fh[0], P["ear_lobe"][1] + fh[1]), P["ear_lobe"], P["ear_top"]),
    }

def marks(sil, gap=None):
    """the profile's points an outline pins by itself, the same rule for the picture's trace and for our head's
    silhouette (top to bottom), so the two compare like with like: the tip (furthest out from the outline's chord),
    the two lips (the furthest out above and below the mouth, off the line from the tip to the outline's end), the
    mouth between them (the deepest), and under the nose the deepest point between the tip and the upper lip. The
    forehead, the nasion and the chin's points are flat stretches no rule pins: those are put by hand on the picture
    and taken on ours where its outline is nearest them"""
    n = len(sil); a, b = sil[0], sil[-1]; sgn = 1 if sum(off(p, a, b) for p in sil) > 0 else -1
    f = lambda p, a, b: sgn * off(p, a, b)
    it = max(range(n), key=lambda i: f(sil[i], a, b)); e = lambda i: f(sil[i], sil[it], b)
    span = math.hypot(sil[it][0] - b[0], sil[it][1] - b[1]); far = lambda i: math.hypot(sil[i][0] - sil[it][0], sil[i][1] - sil[it][1]) / span
    if gap is None:                                       # (ours: no gap; the mouth is the deepest point of the middle stretch)
        mid = [i for i in range(it + 1, n) if 0.25 < far(i) < 0.62]; gap = min(mid, key=e)
    up = [i for i in range(it + 1, gap) if i - it > 0.5 * (gap - it)]   # (the upper lip: the furthest out in the lower half of the way from the tip to the mouth)
    lo = [i for i in range(gap, n) if far(i) < 0.68]
    iul = max(up, key=e); ill = max(lo, key=e)
    isn = min(range(it + 1, iul), key=lambda i: f(sil[i], sil[it], sil[iul])) if iul > it + 1 else it + 1
    ist = min(range(iul, ill + 1), key=e)
    return {"tip": sil[it], "subnasale": sil[isn], "upper_lip": sil[iul], "stomion": sil[ist], "lower_lip": sil[ill]}
def dense(line, step=0.5):
    o = []
    for a, b in zip(line, line[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        o += [(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n) for t in range(n)]
    return o + [line[-1]]
if __name__ == "__main__":
    for name in sys.argv[1:] or PROFILES:
        D = PROFILES[name]; P = dict(D["points"]); sil = D["silhouette"]; P["forehead"] = sil[1]
        M = measures(P, D["jaw"], D["faces"])
        json.dump({"name": name, "file": D["file"], "faces": D["faces"], "silhouette": [p for p in sil if p], "gap": sil.index(None), "jaw": D["jaw"], "points": P, "measures": M}, open(OUT + name + "_profile.json", "w"), indent=1)
        print(name + ":"); [print("  %-50s %6.3f" % (k, v) if abs(v) < 5 else "  %-50s %6.1f" % (k, v)) for k, v in M.items()]
        im = Image.open(D["file"]).convert("RGB"); k = 5; big = im.resize((im.size[0] * k, im.size[1] * k), Image.LANCZOS); d = ImageDraw.Draw(big); q = lambda p: (p[0] * k, p[1] * k)
        run = []
        for p in sil + [None]:
            if p is None:
                if len(run) > 1: d.line([q(a) for a in run], fill=(0, 255, 80), width=2)
                run = []
            else: run.append(p)
        d.line([q(a) for a in D["jaw"][:5]], fill=(255, 220, 0), width=2); d.line([q(a) for a in D["jaw"][5:]], fill=(255, 220, 0), width=2)
        for a, b, c in (("nasion", "subnasale", (0, 200, 255)), ("tip", "pogonion", (255, 120, 255)), ("eye_bottom", "tragus", (255, 255, 255)), ("ear_lobe", "ear_top", (255, 255, 255)), ("nasion", "menton", (0, 200, 255))):
            d.line([q(P[a]), q(P[b])], fill=c, width=1)
        for n, p in P.items():
            x, y = q(p); d.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 60, 60), width=2); d.text((x + 6, y - 5), n, fill=(255, 255, 0))
        big.save(OUT + name + "_ref.jpg", quality=92); print("  ->", OUT + name + "_ref.jpg")

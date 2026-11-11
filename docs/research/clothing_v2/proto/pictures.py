"""The layer test's pictures, made again from nothing: every outfit in outfits/ worn with and without the layers
(wear.py), drawn (render.mjs), the Godot test (godot_test.py), and the five sheets beside the note.

    python pictures.py <work dir> <out dir> [only: a sheet's name ...]

<work dir> as wear.py's: reg.npz, bodies/, sources.json. Takes about twenty minutes on four cores without a GPU.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PY = sys.executable
BG = (20, 20, 22)


def run(cmd, env=None, log=None):
    r = subprocess.run(cmd, capture_output=True, text=True, env={**os.environ, **(env or {})})
    if log:
        Path(log).write_text(r.stdout + r.stderr)
    if r.returncode:
        print("FAILED:", " ".join(str(c) for c in cmd), "\n", (r.stdout + r.stderr)[-1500:])
    return r.returncode == 0


def label(im, text):
    out = Image.new("RGB", (im.width, im.height + 22), BG); out.paste(im, (0, 22))
    ImageDraw.Draw(out).text((6, 5), text, fill=(232, 232, 232))
    return out


def across(ims, gap=4):
    out = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), max(i.height for i in ims)), BG); x = 0
    for i in ims:
        out.paste(i, (x, 0)); x += i.width + gap
    return out


def down(ims, gap=4):
    out = Image.new("RGB", (max(i.width for i in ims), sum(i.height for i in ims) + gap * (len(ims) - 1)), BG); y = 0
    for i in ims:
        out.paste(i, (0, y)); y += i.height + gap
    return out


def main():
    work, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    only = sys.argv[3:]
    pics = work / "pics"; pics.mkdir(exist_ok=True); out.mkdir(parents=True, exist_ok=True)
    outfits = sorted(p.stem for p in (HERE / "outfits").glob("*.json"))

    def wear(o):
        ok = run([PY, str(HERE / "wear.py"), str(work), str(HERE / "outfits" / f"{o}.json"), "--no-layers"], log=work / f"{o}.plain.log")
        return run([PY, str(HERE / "wear.py"), str(work), str(HERE / "outfits" / f"{o}.json")] + (["--glb"] if o == "godot" else []), log=work / f"{o}.layers.log") and ok
    if "--no-wear" not in only:
        with ThreadPoolExecutor(4) as ex:
            print("worn:", dict(zip(outfits, ex.map(wear, outfits))))
    only = [o for o in only if not o.startswith("--")]

    def shot(name, folder, size, bodies="", views="0,50,180", zoom="", looks=""):
        env = dict(VIEWS=views, TIMEOUT="900000")
        if zoom:
            env["ZOOM"] = zoom
        if looks:
            env["LOOKS"] = (HERE / "looks" / f"{looks}.json").read_text()
        for go in range(3):                                         # (a browser drawing on the CPU beside three others now and then loses its picture: looked at, and drawn again)
            run(["node", str(HERE / "render.mjs"), str(work / folder), str(pics / f"{name}.png"), str(size)] + ([bodies] if bodies else []), env)
            px = Image.open(pics / f"{name}.png").convert("RGB").resize((160, 160)).tobytes()
            far = sum(1 for k in range(0, len(px), 3) if abs(px[k] - px[0]) + abs(px[k + 1] - px[1]) + abs(px[k + 2] - px[2]) > 40)
            if far > 0.02 * (len(px) // 3):
                break
            print("blank, again:", name)
        return name
    jobs = dict(
        before_after=[("ba_ss0", "skirt_sweater_plain", 330, "feminine,full_feminine", "0,60,180", "waist"), ("ba_ss1", "skirt_sweater", 330, "feminine,full_feminine", "0,60,180", "waist"),
                      ("ba_polo0", "socks_plain", 330, "feminine", "0,60,180", "waist"), ("ba_polo1", "socks", 330, "feminine", "0,60,180", "waist"),
                      ("ba_coat0", "coat_plain", 300, "feminine"), ("ba_coat1", "coat", 300, "feminine"), ("ba_uni0", "uniform_plain", 300, "feminine"), ("ba_uni1", "uniform", 300, "feminine")],
        legwear=[("lw_tights", "tights", 330, "feminine", "0,60,180", "legs"), ("lw_fishnet", "fishnet", 330, "feminine", "0,60,180", "legs"), ("lw_overknee", "overknee", 330, "feminine", "0,60,180", "legs"),
                 ("lw_socks", "socks", 330, "feminine", "0,60,180", "legs"), ("lw_feet", "uniform", 330, "feminine", "0,60,120", "feet")],
        pbr=[("pbr_uniform", "uniform", 360, "feminine", "0,45,180", "", "uniform"), ("pbr_coat", "coat", 360, "feminine", "0,45,180", "", "coat"), ("pbr_tights", "tights", 360, "feminine", "0,45,180", "", "tights"),
             ("pbr_fishnet", "fishnet", 360, "feminine", "0,45,180", "", "fishnet"), ("pbr_close1", "uniform", 500, "feminine", "0,45", "top", "uniform"), ("pbr_close2", "tights", 500, "feminine", "0,45", "waist", "tights")],
        bodies=[("b_anime", "anime", 290), ("b_anime_uniform", "anime_uniform", 290), ("b_girl", "girl", 290), ("b_boy", "boy", 290), ("b_red", "reddress", 290), ("b_redcoat0", "reddress_coat_plain", 290), ("b_redcoat1", "reddress_coat", 290)],
    )
    todo = [j for k, v in jobs.items() if not only or k in only for j in v]
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda j: shot(*j), todo))
    op = lambda n: Image.open(pics / f"{n}.png").convert("RGB")
    if not only or "before_after" in only:
        s = down([across([label(op("ba_ss0"), "before: each garment fitted alone (a skirt and a sweater)"), label(op("ba_ss1"), "after: layers")]),
                  across([label(op("ba_polo0"), "before (a polo over a pleated skirt)"), label(op("ba_polo1"), "after")]),
                  across([label(op("ba_coat0"), "before (trousers, a sweater, a coat, shoes)"), label(op("ba_coat1"), "after")]),
                  across([label(op("ba_uni0"), "before (a pleated skirt, a polo, a uniform jacket, the tailor's knee socks, shoes)"), label(op("ba_uni1"), "after")])])
        s.save(out / "layers_before_after.jpg", quality=84); print("layers_before_after.jpg", s.size)
    if not only or "legwear" in only:
        s = down([across([label(op("lw_tights"), "the tailor's pantyhose under a library skirt, into library shoes"), label(op("lw_fishnet"), "fishnet tights under a pleated skirt, into boots")]),
                  across([label(op("lw_overknee"), "over-the-knee socks"), label(op("lw_socks"), "crew socks in trainers")]), label(op("lw_feet"), "knee socks into shoes, close")])
        s.save(out / "layers_legwear.jpg", quality=84); print("layers_legwear.jpg", s.size)
    if not only or "pbr" in only:
        s = down([across([label(op("pbr_uniform"), "melton jacket, herringbone skirt, oxford polo (our baked sets, tinted)"), label(op("pbr_coat"), "melton coat, knit sweater, gabardine trousers")]),
                  across([label(op("pbr_tights"), "rib-knit sweater, corduroy skirt, pantyhose"), label(op("pbr_fishnet"), "our denim on the jacket, tweed skirt, jersey tee, fishnets")]),
                  across([label(op("pbr_close1"), "close: melton and oxford at their real size"), label(op("pbr_close2"), "close: rib knit and corduroy")])])
        s.save(out / "layers_pbr.jpg", quality=84); print("layers_pbr.jpg", s.size)
    if not only or "bodies" in only:
        s = down([across([label(op("b_anime"), "Anime, Bust 2.1 (on its dress form) and Bust -2: skirt, sweater, pantyhose"), label(op("b_anime_uniform"), "the same two: uniform jacket, polo, pleated skirt, over-the-knee socks")]),
                  across([label(op("b_girl"), "age 10: pleated skirt, polo, sweater, knee socks"), label(op("b_boy"), "age 14: trousers, polo, denim jacket, crew socks, trainers")]),
                  across([label(op("b_red"), "main's red sweater dress (the tailor's) with pantyhose and library shoes"), label(op("b_redcoat0"), "a library coat over it, before"), label(op("b_redcoat1"), "after")])])
        s.save(out / "layers_bodies.jpg", quality=84); print("layers_bodies.jpg", s.size)
    if not only or "godot" in only:
        gp = work / "godot_pics"
        if run([PY, str(HERE / "godot_test.py"), str(work / "godot"), "feminine", str(gp), str(work / "godot_project")], log=work / "godot.log"):
            g = lambda n, c=None: (Image.open(gp / f"{n}.png").convert("RGB").crop(c) if c else Image.open(gp / f"{n}.png").convert("RGB"))
            c = (90, 40, 550, 930)
            s = down([across([label(g("worn", c), "Godot 4.7: a coat over six garments"), label(g("under", c), "the coat made invisible: what isn't drawn"), label(g("covers", c), "the same, what's hidden painted"),
                              label(g("half", c), "the coat coming off: dissolving back"), label(g("coat_off", c), "the coat off")]),
                      across([label(g("worn_close"), "worn"), label(g("under_close"), "the coat made invisible"), label(g("half_close"), "half way"), label(g("coat_off_close"), "the coat off")])])
            s = s.resize((s.width * 3 // 4, s.height * 3 // 4))
            s.save(out / "layers_godot.jpg", quality=84); print("layers_godot.jpg", s.size)
        print((work / "godot.log").read_text()[-400:])
    print("PICTURES ok ->", out)


if __name__ == "__main__":
    main()

"""The prints library's own pictures (CLOTHING_PLAN 6): a tee's front and back prints made in code, ours, in the
project's OFL fonts (tools/propgen/fonts/, their licences beside them), into Content/Studio/Clothes/prints/ as
transparent PNGs. Your own pictures go in the same folder; the Character Studio lists them all (a print's
"from the library…").

    python tools/character/tailor/make_prints.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
FONTS = ROOT / "tools" / "propgen" / "fonts"
OUT = ROOT / "Content" / "Studio" / "Clothes" / "prints"


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def text_centre(d, xy, s, f, fill, stroke=0, stroke_fill=None):
    x0, y0, x1, y1 = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
    d.text((xy[0] - (x1 + x0) / 2, xy[1] - (y1 + y0) / 2), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def canvas(w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def varsity():
    im, d = canvas(512, 384)
    f = font("Anton-Regular.ttf", 120)
    for i, ch in enumerate("TOKYO"):                                 # the letters on an arch
        a = math.radians(-26 + i * 13)
        c, dd = canvas(130, 160); text_centre(dd, (65, 80), ch, f, (245, 240, 228, 255), 5, (170, 30, 40, 255))
        c = c.rotate(-math.degrees(a), resample=Image.BICUBIC, expand=True)
        x, y = 256 + 360 * math.sin(a), 440 - 360 * math.cos(a)
        im.alpha_composite(c, (int(x - c.width / 2), int(y - c.height / 2)))
    text_centre(d, (256, 270), "1987", font("Anton-Regular.ttf", 96), (170, 30, 40, 255), 4, (245, 240, 228, 255))
    return im


def night_shift():
    im, d = canvas(512, 512)
    d.ellipse((96, 40, 416, 360), outline=(235, 232, 225, 255), width=10)
    d.ellipse((190, 90, 330, 230), fill=(235, 232, 225, 255)); d.ellipse((225, 75, 365, 215), fill=(0, 0, 0, 0))   # a crescent moon
    text_centre(d, (256, 300), "night", font("UnifrakturMaguntia-Book.ttf", 110), (235, 232, 225, 255))
    text_centre(d, (256, 430), "SHIFT", font("BebasNeue-Regular.ttf", 120), (235, 232, 225, 255))
    return im


def sunset():
    im, d = canvas(512, 420)
    cols = [(255, 196, 70), (255, 150, 60), (240, 95, 80), (200, 60, 110), (120, 50, 130)]
    d.pieslice((96, 40, 416, 360), 180, 360, fill=cols[0])
    for i, c in enumerate(cols[1:]):                                 # the sun cut into bands
        y = 140 + i * 18
        d.rectangle((90, y, 422, y + 18), fill=(0, 0, 0, 0)); d.rectangle((90, y + 8, 422, y + 18), fill=c)
    mask = Image.new("L", im.size, 0); ImageDraw.Draw(mask).pieslice((96, 40, 416, 360), 180, 360, fill=255)
    im.putalpha(Image.fromarray(__import__("numpy").minimum(__import__("numpy").array(im.split()[3]), __import__("numpy").array(mask))))
    d = ImageDraw.Draw(im)
    text_centre(d, (256, 300), "SUMMER", font("Bungee-Regular.ttf", 86), (250, 245, 235, 255), 4, (120, 50, 130, 255))
    return im


def smiley():
    im, d = canvas(384, 384)
    d.ellipse((12, 12, 372, 372), fill=(250, 215, 60, 255), outline=(30, 30, 30, 255), width=10)
    d.ellipse((115, 110, 155, 180), fill=(30, 30, 30, 255)); d.ellipse((229, 110, 269, 180), fill=(30, 30, 30, 255))
    d.arc((90, 120, 294, 300), 20, 160, fill=(30, 30, 30, 255), width=14)
    return im


def badge():
    im, d = canvas(256, 256)
    d.ellipse((8, 8, 248, 248), outline=(240, 236, 228, 255), width=8)
    text_centre(d, (128, 120), "HS", font("Righteous-Regular.ttf", 110), (240, 236, 228, 255))
    text_centre(d, (128, 196), "STUDIO", font("BebasNeue-Regular.ttf", 40), (240, 236, 228, 255))
    return im


def staff():
    im, d = canvas(512, 160)
    text_centre(d, (256, 80), "STAFF", font("ArchivoBlack-Regular.ttf", 130), (245, 242, 235, 255))
    return im


def sakura():
    im, d = canvas(512, 300)
    for k in range(5):                                               # a five-petal flower
        a = math.radians(k * 72 - 90); cx, cy = 256 + 46 * math.cos(a), 110 + 46 * math.sin(a)
        d.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), fill=(245, 170, 190, 255))
    d.ellipse((236, 90, 276, 130), fill=(250, 225, 120, 255))
    text_centre(d, (256, 240), "sakura", font("Pacifico-Regular.ttf", 76), (245, 170, 190, 255))
    return im


PRINTS = {"varsity_tokyo": varsity, "night_shift": night_shift, "sunset_summer": sunset, "smiley": smiley,
          "studio_badge": badge, "staff": staff, "sakura": sakura}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in PRINTS.items():
        make().save(OUT / f"{name}.png", optimize=True)
        print(f"  {name}.png")
    print(f"{len(PRINTS)} prints in {OUT.relative_to(ROOT)}")

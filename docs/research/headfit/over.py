# over.py <name> [tag ...]: the fitted head's outline, eyes, nose base and lips drawn over her picture's crop (one panel a tag), the bare crop first
import sys, json
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os; H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + "/"; os.makedirs(H, exist_ok=True)
name = sys.argv[1]; tags = sys.argv[2:] or [""]
src = json.load(open(H + name + ".json")); box = src["box"]; S = 4 if (box[2] - box[0]) < 300 else 3 if (box[2] - box[0]) < 360 else 2
crop = Image.open(src["file"]).convert("RGB").crop(box); big = crop.resize((crop.size[0] * S, crop.size[1] * S), Image.LANCZOS)
panels = [big.copy()]
for tag in tags:
    pj = json.load(open(H + name + tag + "_proj.json")); im = big.copy(); W, Hh = im.size
    mask = Image.new("L", (W, Hh), 0); d = ImageDraw.Draw(mask); t = pj["tri"]
    for i in range(0, len(t), 6): d.polygon([((t[i + k] - box[0]) * S, (t[i + k + 1] - box[1]) * S) for k in (0, 2, 4)], fill=255)
    edge = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(5)), mask.filter(ImageFilter.MinFilter(3)))
    im.paste((255, 60, 60), mask=edge); dr = ImageDraw.Draw(im)
    sc = lambda r: [((x - box[0]) * S, (y - box[1]) * S) for x, y in r]
    for r in (pj["eyeR"], pj["eyeL"], pj["lips"]): dr.line(sc(r) + sc(r)[:1], fill=(60, 255, 120), width=2)
    dr.line(sc(pj["nose"]), fill=(80, 200, 255), width=2)
    for b in pj["brows"]: dr.line(sc(b), fill=(255, 220, 60), width=2)
    panels.append(im)
h = 560; panels = [p.resize((round(p.size[0] * h / p.size[1]), h), Image.LANCZOS) for p in panels]
out = Image.new("RGB", (sum(p.size[0] for p in panels), h)); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.size[0]
out.save(H + name + "_over.jpg", quality=90); print(H + name + "_over.jpg", out.size)

# pover.py <name> [tag ...]: a side picture's trace and our head's outline over it (profit.mjs's out/<name><tag>_pproj.json),
# a panel a tag, the bare picture with its trace first; and the two tables of measures side by side (profile.py)
import sys, json, os, math
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import profile as pf
H = pf.OUT; name = sys.argv[1]; argv = sys.argv[2:]
BOX = None                                              # --box x0,y0,x1,y1: only that part of the picture, larger (--scale)
if "--box" in argv: i = argv.index("--box"); BOX = tuple(int(v) for v in argv[i + 1].split(",")); del argv[i:i + 2]
SC = 5
if "--scale" in argv: i = argv.index("--scale"); SC = int(argv[i + 1]); del argv[i:i + 2]
tags = argv or [""]
D = pf.PROFILES[name]; src = json.load(open(H + name + "_profile.json")); S = SC
xs = [p[0] for p in src["silhouette"]] + [p[0] for p in src["points"].values()]; ys = [p[1] for p in src["silhouette"]] + [p[1] for p in src["points"].values()]
im0 = Image.open(D["file"]).convert("RGB"); box = (max(0, int(min(xs)) - 14), max(0, int(min(ys)) - 22), min(im0.size[0], int(max(xs)) + 22), min(im0.size[1], int(max(ys)) + 30))
box = BOX or box
big = im0.crop(box).resize(((box[2] - box[0]) * S, (box[3] - box[1]) * S), Image.LANCZOS); q = lambda p: ((p[0] - box[0]) * S, (p[1] - box[1]) * S)
g = src["gap"]; A = pf.dense(src["silhouette"][:g]); Bq = pf.dense(src["silhouette"][g:] + [src["points"]["menton"]])
Pp = dict(src["points"]); Pp.update(pf.marks(A + Bq, len(A))); Pp["forehead"] = src["silhouette"][1]
def trace(d):
    d.line([q(p) for p in src["silhouette"][:g]], fill=(0, 255, 80), width=2); d.line([q(p) for p in src["silhouette"][g:]], fill=(0, 255, 80), width=2)
    d.line([q(p) for p in src["jaw"][:5]], fill=(0, 255, 80), width=2); d.line([q(p) for p in src["jaw"][5:]], fill=(0, 255, 80), width=2)
    for k in ("eye_outer", "eye_top", "eye_bottom", "ear_top", "ear_lobe", "ear_back"): x, y = q(src["points"][k]); d.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(0, 255, 80), width=2)
p0 = big.copy(); trace(ImageDraw.Draw(p0)); panels = [p0]; tables = {"picture": pf.measures(Pp, src["jaw"], D["faces"])}
near = lambda line, p: min(line, key=lambda a: (a[0] - p[0]) ** 2 + (a[1] - p[1]) ** 2)
for tag in tags:
    pj = json.load(open(H + name + tag + "_pproj.json")); im = big.copy(); d = ImageDraw.Draw(im); trace(d)
    d.line([q(p) for p in pj["sil"]], fill=(255, 50, 50), width=2); d.line([q(p) for p in pj["jaw"]], fill=(255, 50, 50), width=2)
    d.line([q(p) for p in pj["eye"]] + [q(pj["eye"][0])], fill=(255, 220, 0), width=2); d.line([q(p) for p in pj["lips"]] + [q(pj["lips"][0])], fill=(255, 220, 0), width=1)
    for p in pj["ear"]: x, y = q(p); d.point([x, y], fill=(255, 50, 50))
    for k in ("eye_outer", "eye_top", "eye_bottom", "ear_top", "ear_lobe", "ear_back"): x, y = q(pj["pts"][k]); d.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 50, 50), width=2)
    d.text((6, 6), tag or "fit", fill=(255, 255, 0)); panels.append(im)
    # ours: the outline between where it is nearest the picture's forehead and menton; the rule's points by the rule, the flat ones nearest the picture's
    sil = [tuple(p) for p in pj["sil"]]; i0 = sil.index(near(sil, src["silhouette"][0])); i1 = sil.index(near(sil, src["points"]["menton"])); cut = sil[i0:i1 + 1]
    Po = {k: near(cut, src["points"][k]) for k in ("nasion", "fold", "pogonion", "menton")}; Po["forehead"] = near(cut, src["silhouette"][1]); Po.update(pf.marks(cut, cut.index(near(cut, src["points"]["stomion"]))))   # (ours has no gap: the mouth is where its outline is nearest the picture's)
    for k in ("eye_outer", "eye_top", "eye_bottom", "ear_top", "ear_lobe", "ear_back"): Po[k] = pj["pts"][k]
    Po["eye_front"] = near(pj["eye"], src["points"]["eye_front"])
    tables[tag or "fit"] = pf.measures(Po, [near(pj["jaw"], src["jaw"][0]), near(pj["jaw"], src["jaw"][-1])], D["faces"])
    for k in ("tip", "subnasale", "upper_lip", "stomion", "lower_lip"):
        x, y = q(Po[k]); d.rectangle([x - 3, y - 3, x + 3, y + 3], outline=(255, 50, 50)); x, y = q(Pp[k]); d.rectangle([x - 3, y - 3, x + 3, y + 3], outline=(0, 255, 80))
out = Image.new("RGB", (sum(p.size[0] for p in panels), panels[0].size[1])); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.size[0]
fn = H + name + ("_pover_part.jpg" if BOX else "_pover.jpg"); out.save(fn, quality=90); print(fn, out.size)
keys = list(tables["picture"]); print("%-52s" % "" + "".join("%10s" % k[-9:] for k in tables))
for k in keys: print("%-52s" % k + "".join(("%10.3f" if abs(t[k]) < 5 else "%10.1f") % t[k] for t in tables.values()))

# lm.py: MediaPipe's face landmarks on crops of the reference pictures -> heads/<name>.json (pixels in the source picture)
import sys, os, json
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..") + "/"
SRC = {"d2a": (R + "Saved/Hair2/daz/ref/d2.jpg", (40, 0, 330, 350)), "d2b": (R + "Saved/Hair2/daz/ref/d2.jpg", (600, 60, 936, 350)),
       "d3": (R + "Saved/Hair2/daz/ref/d3.jpg", (150, 100, 591, 560)), "d4a": (R + "Saved/Hair2/daz/ref/d4.png", (60, 0, 260, 200)), "d4b": (R + "Saved/Hair2/daz/ref/d4.png", (340, 20, 540, 220)),
       "t1": (R + "Saved/Body/ref/t1.jpg", (440, 230, 680, 470)), "d1": (R + "Saved/Hair2/daz/ref/d1.png", (0, 60, 400, 400)), "d5": (R + "Saved/Hair2/daz/ref/d5.png", (540, 0, 960, 380)),
       "h1": (R + "Saved/Heads/ref/h1.png", (0, 0, 447, 447)), "h2": (R + "Saved/Heads/ref/h2.png", (0, 0, 276, 316))}
opt = vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=R + "vendor/face_mesh/face_landmarker.task"), output_face_blendshapes=True, output_facial_transformation_matrixes=True, num_faces=1, min_face_detection_confidence=0.2, min_face_presence_confidence=0.2)
det = vision.FaceLandmarker.create_from_options(opt)
for name in sys.argv[1:] or SRC:
    f, box = SRC[name]; im = Image.open(f).convert("RGB").crop(box); k = max(1, round(640 / max(im.size)))
    big = im.resize((im.size[0] * k, im.size[1] * k), Image.LANCZOS); big.save(f"{name}_crop.jpg", quality=92)
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(big)))
    if not r.face_landmarks: print(name, "no face"); continue
    L = r.face_landmarks[0]; W, H = big.size
    pts = [[box[0] + p.x * W / k, box[1] + p.y * H / k, p.z * W / k] for p in L]
    bs = {c.category_name: round(c.score, 3) for c in r.face_blendshapes[0]}
    M = np.array(r.facial_transformation_matrixes[0]).tolist()
    json.dump({"name": name, "file": f, "box": box, "k": k, "pts": pts, "blend": bs, "M": M}, open(f"{name}.json", "w"))
    top = sorted(bs.items(), key=lambda x: -x[1])[:7]
    Rm = np.array(M)[:3, :3]; yaw = np.degrees(np.arctan2(Rm[0, 2], Rm[2, 2])); pitch = np.degrees(np.arcsin(-Rm[1, 2]))
    eye = np.hypot(pts[33][0] - pts[263][0], pts[33][1] - pts[263][1])
    print(name, "face", big.size, "x%d" % k, "outer eye corners %.0f px apart in the source" % eye, "yaw %.0f pitch %.0f" % (yaw, pitch), top)
    # draw
    from PIL import ImageDraw
    d = ImageDraw.Draw(big)
    for p in L: d.ellipse([p.x * W - 1.5, p.y * H - 1.5, p.x * W + 1.5, p.y * H + 1.5], fill=(0, 255, 0))
    big.save(f"{name}_lm.jpg", quality=90)

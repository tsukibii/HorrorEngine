"""A character's skin from its front picture, on MHR's UVs (numpy, OpenCV; run by face_mesh.py's worker for the
Character Studio). The picture's 468 landmarks sit on known points of the finished head (the face fit's binding), so a
camera is fitted from them (an affine one: a portrait's lens is long enough); every triangle that faces that camera
inside the face's outline is warped from the picture into its place on the texture. Above the brows only skin-coloured
pixels count, so bangs don't paint the forehead. The rest of the body takes the face's own median skin tone, and the
edge is feathered into it. Eyes and mouth are painted on MHR's closed shell until the face parts come.
"""
import numpy as np

FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176,
             149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
BROWS = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]
CHEEKS = [50, 280, 205, 425, 187, 411]                    # where the skin tone is read


def camera(points3d, pixels):
    """the affine camera (4x2) taking points (n,3) to pixels (n,2), and the direction it looks from (unit, in the
    points' frame, toward the camera)"""
    X = np.hstack([points3d, np.ones((len(points3d), 1))])
    P = np.linalg.lstsq(X, pixels, rcond=None)[0]
    d = np.cross(P[:3, 0], P[:3, 1])
    d /= np.linalg.norm(d)
    if d[2] < 0: d = -d                                    # MHR faces +Z: the camera is in front
    return P, d


def bake(img, landmarks, verts, tris, uvs, bound, size=2048, feather=0.012):
    """img (BGR picture), landmarks (468,2 pixels), verts (n,3, the finished body), tris (m,3), uvs (m,3,2 per corner,
    v up), bound (468,3: the landmarks' places on verts). Returns the texture (size,size,3 BGR, uint8), the alpha the
    picture covers (size,size float) and a report."""
    import cv2
    h, w = img.shape[:2]
    P, look = camera(bound, landmarks)
    pix = np.hstack([verts, np.ones((len(verts), 1))]) @ P
    n = np.cross(verts[tris[:, 1]] - verts[tris[:, 0]], verts[tris[:, 2]] - verts[tris[:, 0]])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    facing = np.clip((n @ look - 0.25) / 0.45, 0, 1)

    # what of the picture counts: inside the face's outline (shrunk a little, feathered), and above the brows only skin
    lm = landmarks.astype(np.float32)
    mask = np.zeros((h, w), np.float32)
    cv2.fillConvexPoly(mask, cv2.convexHull(lm[FACE_OVAL]).astype(np.int32), 1.0)
    face_w = np.ptp(lm[FACE_OVAL, 0])
    k = max(3, int(face_w * 0.04) | 1)
    mask = cv2.erode(mask, np.ones((k, k), np.uint8))
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    cheek = np.zeros((h, w), np.uint8)
    for i in CHEEKS: cv2.circle(cheek, tuple(int(v) for v in lm[i]), max(2, int(face_w * 0.04)), 1, -1)
    tone_lab = np.median(lab[cheek > 0], axis=0)
    tone = np.median(img[cheek > 0], axis=0)
    brow_y = lm[BROWS, 1].mean()                           # from the middle of the brows up: bangs end on the brows
    ys = np.arange(h)[:, None].repeat(w, 1)
    skinlike = np.exp(-(np.linalg.norm(lab - tone_lab, axis=2) / 28.0) ** 2)
    gate = np.clip((skinlike - 0.35) / 0.35, 0, 1)         # sharp: a few strands of hair don't pass as skin
    gate = cv2.erode(gate, np.ones((3, 3), np.uint8))
    mask = np.where(ys < brow_y, mask * gate, mask)
    mask = cv2.GaussianBlur(mask, (0, 0), max(1.0, face_w * 0.02))

    # warp each facing triangle from the picture into the texture
    tex = np.empty((size, size, 3), np.float32); tex[:] = np.asarray(tone, np.float32)   # unseen: the tone, no dark seam
    alpha = np.zeros((size, size), np.float32)
    src_img = img.astype(np.float32)
    used = 0
    for t in np.flatnonzero(facing > 0):
        s = pix[tris[t]].astype(np.float32)
        if (s[:, 0] < 0).any() or (s[:, 1] < 0).any() or (s[:, 0] >= w).any() or (s[:, 1] >= h).any(): continue
        d = np.stack([uvs[t, :, 0] * size, (1 - uvs[t, :, 1]) * size], 1).astype(np.float32)
        x0, y0 = np.floor(d.min(0)).astype(int); x1, y1 = np.ceil(d.max(0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, size), min(y1, size)
        if x1 <= x0 or y1 <= y0: continue
        M = cv2.getAffineTransform(s, (d - [x0, y0]).astype(np.float32))
        ww, hh = x1 - x0, y1 - y0
        patch = cv2.warpAffine(src_img, M, (ww, hh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        pm = cv2.warpAffine(mask, M, (ww, hh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        tri = np.zeros((hh, ww), np.float32)
        cv2.fillConvexPoly(tri, np.round((d - [x0, y0]) * 16).astype(np.int32), 1.0, cv2.LINE_8, 4)
        a = tri * pm * float(facing[t])
        sel = a > alpha[y0:y1, x0:x1]
        tex[y0:y1, x0:x1][sel] = patch[sel]
        alpha[y0:y1, x0:x1][sel] = a[sel]
        used += 1
    alpha = cv2.GaussianBlur(alpha, (0, 0), size * feather * 0.25)
    out = tex * alpha[..., None] + np.asarray(tone, np.float32) * (1 - alpha[..., None])
    report = dict(triangles=used, tone_bgr=[round(float(v)) for v in tone], camera_look=[round(float(v), 3) for v in look],
                  coverage=round(float((alpha > 0.5).mean()), 4))
    return np.clip(out, 0, 255).astype(np.uint8), alpha, report

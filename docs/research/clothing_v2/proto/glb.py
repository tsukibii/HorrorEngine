"""A layered outfit as one .glb for Godot: the body and each garment a mesh of its own, and in every mesh's vertex
colours what each band of layers hides of it (layers.BANDS: red under bottoms, green under tops, blue under outerwear,
alpha under legwear and shoes), each stored as (cover + 1) / 3 with the cover held to -1..2: 0 is the place the
dissolve starts, 1 where the cloth is gone. godot/cover.gdshader reads them."""
import json
import struct
from pathlib import Path

import numpy as np


def encode(covers):
    """(4, n) covers -> (n, 4) vertex colours"""
    return ((np.clip(covers, -1.0, 2.0) + 1.0) / 3.0).T.astype(np.float32)


def write(path, meshes):
    """meshes: [{name, P (n,3), N (n,3), T (m,3), UV (n,2) | None, UV2 (n,2) | None, COVER (4,n) | None,
    color (r, g, b, a), texture: a file | None, alpha: None | "mask" | "blend", extras: {}}]"""
    blob = bytearray()
    views, accs, images, textures, materials, gmeshes, nodes = [], [], [], [], [], [], []

    def view(data, target=None):
        while len(blob) % 4:
            blob.append(0)
        v = dict(buffer=0, byteOffset=len(blob), byteLength=len(data))
        if target:
            v["target"] = target
        blob.extend(data); views.append(v)
        return len(views) - 1

    def acc(a, kind, target=34962):
        a = np.ascontiguousarray(a)
        d = dict(bufferView=view(a.tobytes(), target), componentType=5125 if a.dtype == np.uint32 else 5126, count=int(a.shape[0]), type=kind)
        if kind == "VEC3" and a.dtype == np.float32:
            d["min"] = [float(x) for x in a.min(0)]; d["max"] = [float(x) for x in a.max(0)]
        accs.append(d)
        return len(accs) - 1

    for m in meshes:
        att = dict(POSITION=acc(m["P"].astype(np.float32), "VEC3"), NORMAL=acc(m["N"].astype(np.float32), "VEC3"))
        if m.get("UV") is not None:
            uv = m["UV"].astype(np.float32).copy(); uv[:, 1] = 1.0 - uv[:, 1]          # glTF's v runs down
            att["TEXCOORD_0"] = acc(uv, "VEC2")
        if m.get("UV2") is not None:
            uv = m["UV2"].astype(np.float32).copy(); uv[:, 1] = -uv[:, 1]
            att["TEXCOORD_1"] = acc(uv, "VEC2")
        if m.get("COVER") is not None:
            att["COLOR_0"] = acc(encode(m["COVER"]), "VEC4")
        mat = dict(name=m["name"], doubleSided=True, pbrMetallicRoughness=dict(baseColorFactor=[float(c) for c in m.get("color", (1, 1, 1, 1))], metallicFactor=0.0, roughnessFactor=0.85))
        tex = m.get("texture")
        if tex and Path(tex).exists():
            data = Path(tex).read_bytes()
            images.append(dict(bufferView=view(data), mimeType="image/png" if data[:4] == b"\x89PNG" else "image/jpeg"))
            textures.append(dict(source=len(images) - 1, sampler=0))
            mat["pbrMetallicRoughness"]["baseColorTexture"] = dict(index=len(textures) - 1)
        if m.get("alpha") == "mask":
            mat["alphaMode"] = "MASK"; mat["alphaCutoff"] = 0.4
        elif m.get("alpha") == "blend":
            mat["alphaMode"] = "BLEND"
        materials.append(mat)
        gmeshes.append(dict(name=m["name"], primitives=[dict(attributes=att, indices=acc(m["T"].astype(np.uint32).reshape(-1), "SCALAR", 34963), material=len(materials) - 1)]))
        nodes.append(dict(name=m["name"], mesh=len(gmeshes) - 1, extras=m.get("extras", {})))
    while len(blob) % 4:
        blob.append(0)
    doc = dict(asset=dict(version="2.0", generator="HorrorStudio clothing_v2 proto"), scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=gmeshes,
               materials=materials, accessors=accs, bufferViews=views, buffers=[dict(byteLength=len(blob))])
    if images:
        doc.update(images=images, textures=textures, samplers=[dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)])
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(bytes(blob))

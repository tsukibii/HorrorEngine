"""Shader node trees written as expressions: each call adds a node and gives back its output socket, so a finish
reads as a few lines of maths instead of a page of links. Numbers and tuples are set as the inputs' values."""
import math

import bpy

TAU = 2 * math.pi


def sock(coll, ident):
    """A socket by its identifier (the Mix node's names repeat for each kind of value)."""
    return next(s for s in coll if s.identifier == ident)


class NB:
    def __init__(self, tree):
        self.t, self.nodes, self.links = tree, tree.nodes, tree.links
        self.k = 0

    # ---- plumbing ----------------------------------------------------------------------------------------------
    def node(self, kind, **props):
        n = self.nodes.new(kind)
        n.location = (220 * (self.k // 14), -170 * (self.k % 14))
        self.k += 1
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def put(self, v, inp):
        """v (a socket, a number, a tuple) into the input `inp`."""
        if v is None:
            return
        if hasattr(v, "is_output"):
            self.links.new(v, inp)
        elif isinstance(v, (tuple, list)):
            dv = inp.default_value
            n = len(dv)
            vals = list(v) + [1.0] * (n - len(v))
            inp.default_value = vals[:n]
        else:
            inp.default_value = v

    def inputs(self, n, **vals):
        for k, v in vals.items():
            self.put(v, n.inputs[k])
        return n

    # ---- maths -------------------------------------------------------------------------------------------------
    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.put(a, n.inputs[0])
        if b is not None:
            self.put(b, n.inputs[1])
        if c is not None:
            self.put(c, n.inputs[2])
        return n.outputs[0]

    def add(self, a, b): return self.math("ADD", a, b)
    def sub(self, a, b): return self.math("SUBTRACT", a, b)
    def mul(self, a, b, clamp=False): return self.math("MULTIPLY", a, b, clamp=clamp)
    def div(self, a, b): return self.math("DIVIDE", a, b)
    def pow(self, a, b): return self.math("POWER", a, b)
    def mx(self, a, b): return self.math("MAXIMUM", a, b)
    def mn(self, a, b): return self.math("MINIMUM", a, b)
    def madd(self, a, b, c): return self.math("MULTIPLY_ADD", a, b, c)
    def clamp(self, a): return self.math("ADD", a, 0.0, clamp=True)
    def absf(self, a): return self.math("ABSOLUTE", a)
    def sin(self, a): return self.math("SINE", a)
    def cos(self, a): return self.math("COSINE", a)
    def fract(self, a): return self.math("FRACT", a)
    def floor(self, a): return self.math("FLOOR", a)
    def one_minus(self, a): return self.math("SUBTRACT", 1.0, a)

    def ramp(self, x, lo, hi, to=(0.0, 1.0), smooth=True):
        """x from lo..hi onto to (clamped), smoothstep by default."""
        n = self.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP" if smooth else "LINEAR", clamp=True)
        self.put(x, n.inputs["Value"])
        self.put(lo, n.inputs["From Min"])
        self.put(hi, n.inputs["From Max"])
        self.put(to[0], n.inputs["To Min"])
        self.put(to[1], n.inputs["To Max"])
        return n.outputs["Result"]

    def mix(self, f, a, b, blend="MIX"):
        """Colours: a to b by f."""
        n = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_result=False)
        self.put(f, sock(n.inputs, "Factor_Float"))
        self.put(a, sock(n.inputs, "A_Color"))
        self.put(b, sock(n.inputs, "B_Color"))
        return sock(n.outputs, "Result_Color")

    def mixf(self, f, a, b):
        n = self.node("ShaderNodeMix", data_type="FLOAT")
        self.put(f, sock(n.inputs, "Factor_Float"))
        self.put(a, sock(n.inputs, "A_Float"))
        self.put(b, sock(n.inputs, "B_Float"))
        return sock(n.outputs, "Result_Float")

    def cmul(self, a, b):
        """A colour times a colour or a number."""
        return self.mix(1.0, a, b if hasattr(b, "is_output") or isinstance(b, (tuple, list)) else (b, b, b, 1), "MULTIPLY")

    def vmath(self, op, a, b=None, out=0):
        n = self.node("ShaderNodeVectorMath", operation=op)
        self.put(a, n.inputs[0])
        if b is not None:
            self.put(b, n.inputs[1])
        return n.outputs[out]

    def sep(self, v):
        n = self.node("ShaderNodeSeparateXYZ")
        self.put(v, n.inputs[0])
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def comb(self, x, y, z):
        n = self.node("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.put(v, n.inputs[i])
        return n.outputs[0]

    def sepc(self, c):
        n = self.node("ShaderNodeSeparateColor")
        self.put(c, n.inputs[0])
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def hsv(self, c, h=0.5, s=1.0, v=1.0):
        n = self.node("ShaderNodeHueSaturation")
        self.inputs(n, Hue=h, Saturation=s, Value=v, Color=c)
        n.inputs["Fac"].default_value = 1.0
        return n.outputs[0]

    # ---- where -------------------------------------------------------------------------------------------------
    def uv(self, name):
        return self.node("ShaderNodeUVMap", uv_map=name).outputs[0]

    def geo(self, out):
        return self.node("ShaderNodeNewGeometry").outputs[out]

    def attr(self, name, out="Fac"):
        return self.node("ShaderNodeAttribute", attribute_name=name).outputs[out]

    def torus(self, uv, period):
        """uv (metres) onto a flat torus in 4D, `period` (pu, pv) metres round each way: noise read there repeats
        every period and is seamless, so what's baked from it tiles (the Clifford torus keeps distances)."""
        pu, pv = period if isinstance(period, (tuple, list)) else (period, period)
        u, v, _ = self.sep(uv)
        au, av = self.mul(u, TAU / pu), self.mul(v, TAU / pv)
        ru, rv = pu / TAU, pv / TAU
        return self.comb(self.mul(self.cos(au), ru), self.mul(self.sin(au), ru), self.mul(self.cos(av), rv)), self.mul(self.sin(av), rv)

    # ---- patterns ----------------------------------------------------------------------------------------------
    def noise(self, at, scale, detail=2.0, rough=0.5, w=None, distort=0.0, out="Fac", kind="FBM"):
        """Noise at `at` (a vector socket, or a torus pair (vector, w) for 4D), about 0..1 around 0.5."""
        if isinstance(at, tuple):
            at, w = at
        n = self.node("ShaderNodeTexNoise", noise_dimensions="4D" if w is not None else "3D", noise_type=kind)
        self.inputs(n, Vector=at, Scale=scale, Detail=detail, Roughness=rough, Distortion=distort)
        if w is not None:
            self.put(w, n.inputs["W"])
        return n.outputs[out]

    def voronoi(self, at, scale, feature="F1", metric="EUCLIDEAN", rand=1.0, w=None, out="Distance"):
        if isinstance(at, tuple):
            at, w = at
        n = self.node("ShaderNodeTexVoronoi", voronoi_dimensions="4D" if w is not None else "3D", feature=feature, distance=metric)
        self.inputs(n, Vector=at, Scale=scale, Randomness=rand)
        if w is not None:
            self.put(w, n.inputs["W"])
        return n.outputs[out]

    def image(self, img, at=None, interp="Linear", ext="REPEAT", out="Color"):
        n = self.node("ShaderNodeTexImage", image=img, interpolation=interp, extension=ext)
        if at is not None:
            self.put(at, n.inputs["Vector"])
        return n.outputs[out]

    def group(self, ng, **vals):
        n = self.node("ShaderNodeGroup")
        n.node_tree = ng
        for k, v in vals.items():
            self.put(v, n.inputs[k])
        return n


def group(name, ins, outs):
    """A shader node group with sockets [(name, type, default)]; its input and output nodes."""
    ng = bpy.data.node_groups.get(name)
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new(name, "ShaderNodeTree")
    for nm, kind, dv in ins:
        s = ng.interface.new_socket(nm, in_out="INPUT", socket_type=kind)
        if dv is not None:
            s.default_value = dv
    for nm, kind in outs:
        ng.interface.new_socket(nm, in_out="OUTPUT", socket_type=kind)
    nb = NB(ng)
    gi, go = nb.node("NodeGroupInput"), nb.node("NodeGroupOutput")
    return ng, nb, gi, go


def srgb(h):
    """'#rrggbb' as linear RGBA."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

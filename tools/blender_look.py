"""The studio's look in Blender: Light Kit's day, dusk and night, and UltraVHS's camcorder, set up on any scene
(docs/BLENDER_LOOK.md is the guide, with the same by hand). Run it inside Blender:

    blender scene.blend --python tools/blender_look.py -- --time night --vhs camcorder --windows --handheld --save
    (or open it in Blender's Text Editor and Run Script: then it uses DEFAULTS below)

  --time day|dusk|night    the sky (Blender's physical sky by day and dusk, a deep-blue gradient at night), the sun
                           or the moon (soft: 1 to 1.5 degrees), a faint haze, the exposure and the grade
  --vhs camcorder|worn|nightmare|off
                           the camcorder as compositor nodes after UltraVHS's passes: the lens (barrel, fringe,
                           vignette), the sensor (saturation, lifted blacks, whites short of full), the tape (soft
                           luma with the deck's edge halo, colour bled wide), 4:3; at night its night mode (black
                           records as a cool blue, 0.02 0.03 0.05, not the warm lift)
  --windows                an area light in every object named window* (any case), the size of its larger face,
                           facing into the room (the side away from the sun), the window's light for the time of day;
                           in Cycles also a portal there (Light Kit Window's sky fill and portal)
  --handheld               the camera's slow handheld drift on its rotation (UltraVHS's Handheld: 0.35 Hz)
  --engine cycles|eevee    (default: leave the scene's)
  --save                   save the .blend after

Everything it makes is named LK_* or VHS_* and running it again replaces them; the user's own lights and nodes are
left alone (the compositor's VHS nodes go between the Render Layers and the Composite). Written for Blender 4.2 and
newer: the names that changed in 5.0 (the compositor's node group, the sky's models, inputs that became sockets) are
tried both ways.
"""
import math
import sys

import bpy
import mathutils

DEFAULTS = {"time": "night", "vhs": "camcorder", "windows": True, "handheld": True, "engine": None, "save": False}

# Light Kit's times of day (LightKitTypes.cpp) in Blender's units, tuned by rendering a room with a window
# (docs/BLENDER_LOOK.md, "Checking"). sun: elevation and azimuth (degrees), strength (W/m^2), colour, angle (degrees);
# sky: the physical sky's strength, or a gradient's zenith and horizon (night); window: colour and watts per m^2 of glass;
# haze: how much of the distance fades to its colour (the Mist pass, in the compositor: a world volume would swallow
# the sky); exposure in stops; grade: saturation, the shadows' lift (added)
TIMES = {
    "day": {"sun": (50, 135, 4.0, (1.0, 0.95, 0.88), 1.0), "sky": {"physical": 0.25},
            "window": ((0.8, 0.88, 1.0), 120.0), "haze": (0.0, (0.45, 0.64, 1.0)), "exposure": -0.5,
            "grade": (1.0, (0.0, 0.0, 0.0))},
    "dusk": {"sun": (6, 135, 2.5, (1.0, 0.6, 0.34), 1.5), "sky": {"physical": 0.5},
             "window": ((1.0, 0.72, 0.58), 30.0), "haze": (0.25, (0.3, 0.15, 0.1)), "exposure": 0.0,
             "grade": (1.05, (0.0, 0.0, 0.003))},
    "night": {"sun": (35, 135, 0.3, (0.55, 0.7, 1.0), 1.0), "sky": {"zenith": (0.008, 0.016, 0.05), "horizon": (0.04, 0.07, 0.16)},
              "window": ((0.35, 0.5, 1.0), 6.0), "haze": (0.4, (0.01, 0.02, 0.05)), "exposure": 0.0,
              "grade": (0.8, (0.0, 0.004, 0.012))},
}

# UltraVHS's presets (UltraVHSSettings.cpp), the knobs the compositor can carry; distances in 480-line tape pixels
CAMCORDER = {"distortion": 0.085, "fringe": 0.0, "vignette": 0.08, "black": (0.035, 0.027, 0.022), "white": (0.82, 0.81, 0.78),
             "saturation": 0.8, "luma_blur": 1.4, "sharpen": 1.0, "sharpen_radius": 3.0, "chroma_blur": 2.0, "chroma_shift": 0.0,
             "chroma_vertical": 0.5, "noise": 0.0}
VHS = {
    "camcorder": CAMCORDER,
    "worn": dict(CAMCORDER, saturation=0.7, luma_blur=1.6, chroma_blur=3.0, chroma_shift=1.5, noise=0.25),
    "nightmare": dict(CAMCORDER, saturation=0.55, black=(0.06, 0.045, 0.045), white=(0.74, 0.72, 0.70), luma_blur=1.8,
                      chroma_blur=4.5, chroma_shift=3.0, noise=0.5),
}
NIGHT_BLACK = (0.02, 0.03, 0.05)       # UltraVHS's night mode
LUMA_K, HALO_K, SHARPEN_K, CHROMA_K = 3.3, 3.0, 1.0, 3.5   # Blender's blur sizes and the halo's mix for UltraVHS's knobs,
                                                           # measured on its test chart (docs/BLENDER_LOOK.md, Checking)
HANDHELD = {"pitch": 0.45, "yaw": 0.6, "roll": 0.35, "hz": 0.35}   # degrees, the drift's speed


def args():
    a = dict(DEFAULTS)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
    if argv is None:
        return a
    a.update(windows=False, handheld=False)       # from the command line only what it says
    it = iter(argv)
    for w in it:
        k = w.lstrip("-")
        if k in ("windows", "handheld", "save"):
            a[k] = True
        elif k in ("time", "vhs", "engine"):
            a[k] = next(it)
        else:
            sys.exit(f"blender_look: unknown {w}")
    if a["time"] not in TIMES or (a["vhs"] != "off" and a["vhs"] not in VHS):
        sys.exit(f"blender_look: --time {'|'.join(TIMES)}, --vhs {'|'.join(VHS)}|off")
    return a


def setin(node, names, value):
    """Sets a node's setting whether it's an input socket (newer Blender) or a property (older): each name is tried as
    an input, then as a property (give a property its exact name: a node's `width` is its size on the canvas)."""
    for n in names if isinstance(names, (list, tuple)) else [names]:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
        if n.islower() and hasattr(node, n):
            setattr(node, n, value)
            return True
    return False


# ---- the time of day ---------------------------------------------------------------------------------------------
def world(scene, t):
    T = TIMES[t]
    w = bpy.data.worlds.get("LK_World") or bpy.data.worlds.new("LK_World")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    elev, az = math.radians(T["sun"][0]), math.radians(T["sun"][1])
    sky = None
    if "physical" in T["sky"]:
        sky = nt.nodes.new("ShaderNodeTexSky")
        for model in ("NISHITA", "MULTIPLE_SCATTERING", "SINGLE_SCATTERING"):
            try:
                sky.sky_type = model
                break
            except TypeError:
                continue
        for k, v in (("sun_elevation", elev), ("sun_rotation", az), ("sun_disc", False), ("altitude", 0.0),
                     ("air_density", 1.0), ("dust_density", 1.0), ("ozone_density", 1.0)):
            if hasattr(sky, k):
                setattr(sky, k, v)
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = T["sky"]["physical"]
    else:                                     # night: the sky a deep blue, brighter toward the horizon (never black)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        e = ramp.color_ramp.elements
        e[0].position, e[1].position = 0.0, 0.6
        e[0].color = (*T["sky"]["horizon"], 1.0)
        e[1].color = (*T["sky"]["zenith"], 1.0)
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 1.0
    w.mist_settings.start, w.mist_settings.depth, w.mist_settings.falloff = 4.0, 80.0, "QUADRATIC"   # the haze's reach
    return w


def sun(scene, t):
    T = TIMES[t]
    elev, az, strength, colour, angle = T["sun"]
    data = bpy.data.lights.get("LK_Sun") or bpy.data.lights.new("LK_Sun", "SUN")
    data.energy, data.color, data.angle = strength, colour, math.radians(angle)
    ob = bpy.data.objects.get("LK_Sun") or bpy.data.objects.new("LK_Sun", data)
    if ob.name not in scene.collection.all_objects:
        scene.collection.objects.link(ob)
    # a sun lamp shines down its -Z: tilt it to the elevation, turn it to the azimuth (the compass it comes from)
    ob.rotation_euler = (math.radians(90 - elev), 0.0, math.radians(az) + math.pi / 2)
    ob.location = (0, 0, 10)
    return ob


def sun_dir(t):
    elev, az = (math.radians(x) for x in TIMES[t]["sun"][:2])
    return (math.cos(elev) * math.cos(az), math.cos(elev) * math.sin(az), math.sin(elev))   # toward the sun


def inward(scene, at, normal, t):
    """Which way a window faces into its room: the side whose rays meet walls sooner (the room), else away from the sun."""
    dg = bpy.context.evaluated_depsgraph_get()

    def reach(d):
        hits = []
        for dx, dy in ((0, 0), (0.3, 0), (-0.3, 0), (0, 0.3), (0, -0.3)):
            v = (d + mathutils.Vector((dx, dy, 0.2 * dy))).normalized()
            hit, loc, *_ = scene.ray_cast(dg, at + d * 0.05, v, distance=30.0)
            hits.append((loc - at).length if hit else 30.0)
        return sum(hits) / len(hits)
    a, b = reach(normal), reach(-normal)
    if abs(a - b) > 0.5:
        return normal if a < b else -normal
    return -normal if normal.dot(mathutils.Vector(sun_dir(t))) > 0 else normal


def windows(scene, t):
    """An area light (and in Cycles a portal) in every window*, the size of its glass, facing into the room (a
    window object's thinnest axis is its normal)."""
    col, per_m2 = TIMES[t]["window"]
    made = []
    for ob in [o for o in scene.objects if o.name.lower().startswith("window") and o.type == "MESH"]:
        dims = sorted(zip(ob.dimensions, range(3)))
        thin = dims[0][1]
        w, h = dims[2][0], dims[1][0]
        n = [0.0, 0.0, 0.0]
        n[thin] = 1.0
        normal = (ob.matrix_world.to_3x3() @ mathutils.Vector(n)).normalized()
        normal = inward(scene, ob.matrix_world.translation, normal, t)
        for kind, power in (("LK_Window", per_m2 * w * h), ("LK_Portal", 0.0)):
            name = f"{kind}_{ob.name}"
            data = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
            data.shape, data.size, data.size_y, data.color, data.energy = "RECTANGLE", w, h, col, power
            if kind == "LK_Portal":
                if hasattr(data, "cycles") and hasattr(data.cycles, "is_portal"):
                    data.cycles.is_portal = True
                else:
                    continue
            lo = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
            if lo.name not in scene.collection.all_objects:
                scene.collection.objects.link(lo)
            lo.location = ob.matrix_world.translation + normal * 0.02
            lo.rotation_euler = normal.to_track_quat("-Z", "Y").to_euler()   # an area light shines down its -Z
            made.append(lo)
    return made


def time_of_day(scene, t, with_windows):
    for ob in [o for o in bpy.data.objects if o.name.startswith(("LK_Window_", "LK_Portal_"))]:
        bpy.data.objects.remove(ob)
    world(scene, t)
    sun(scene, t)
    return windows(scene, t) if with_windows else []


# ---- the camcorder (UltraVHS's passes as compositor nodes) -----------------------------------------------------------
def comp_tree(scene):
    """The compositor's node tree: Blender 5's node group, or the scene's own tree before it."""
    if hasattr(scene, "compositing_node_group"):
        g = scene.compositing_node_group
        if g is None:
            g = bpy.data.node_groups.new("Compositor", "CompositorNodeTree")
            scene.compositing_node_group = g
        return g
    scene.use_nodes = True
    return scene.node_tree


DISPLAY = ("AgX Base sRGB", "Filmic sRGB", "sRGB")   # the tonemapper the camcorder records after (UltraVHS runs after Unreal's)


def composite(scene, t, preset, source=None, display=DISPLAY):
    """The compositor, between the Render Layers (or `source`, a test chart's image) and the Composite: the time's
    grade (saturation, the shadows lifted toward blue: Light Kit's post-process), then, with a camcorder, UltraVHS's
    passes. Those work on display colour, after the tonemapper, as in Unreal: so the picture is tonemapped here
    (AgX), graded on tape, turned back to linear, and the view transform is Standard (nothing applied twice)."""
    T, vs = TIMES[t], scene.view_settings
    nt = comp_tree(scene)
    for n in [n for n in nt.nodes if n.name.startswith(("VHS_", "LK_"))]:
        nt.nodes.remove(n)
    nodes, links = nt.nodes, nt.links
    xs = iter(range(200, 6000, 180))

    def node(kind, name, **props):
        n = nodes.new(kind)
        n.name = n.label = name
        n.location = (next(xs), 0)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def mix(name, blend, a, b, fac=1.0):
        m = node("CompositorNodeMixRGB", name, blend_type=blend)
        m.inputs["Fac"].default_value = fac
        links.new(a, m.inputs[1])
        links.new(b, m.inputs[2])
        return m.outputs["Image"]

    def blur(name, sx, sy, inp):
        b = node("CompositorNodeBlur", name, filter_type="GAUSS")
        if hasattr(b, "size_x"):              # pixels, as properties (4.x); a vector input later
            b.size_x, b.size_y = int(round(sx)), int(round(sy))
        else:
            b.inputs["Size"].default_value = (sx, sy)
        links.new(inp, b.inputs["Image"])
        return b.outputs["Image"]

    def space(name, frm, to):
        c = node("CompositorNodeConvertColorSpace", name)
        for k, names in (("from_color_space", frm), ("to_color_space", to)):
            for nm in names:
                try:
                    setattr(c, k, nm)
                    break
                except TypeError:
                    continue
        return c

    rl = next((n for n in nodes if n.bl_idname == "CompositorNodeRLayers"), None) or nodes.new("CompositorNodeRLayers")
    comp = next((n for n in nodes if n.bl_idname == "CompositorNodeComposite"), None)
    if comp is None:
        try:
            comp = nodes.new("CompositorNodeComposite")
        except RuntimeError:                  # Blender 5: the group's output is the composite
            comp = next((n for n in nodes if n.bl_idname == "NodeGroupOutput"), None) or nodes.new("NodeGroupOutput")
            if not comp.inputs or comp.inputs[0].type != "RGBA":
                nt.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    last = source or rl.outputs["Image"]
    amount, haze = T["haze"]
    if amount > 0 and source is None:         # the haze in the distance: the Mist pass, the far fading to the time's colour
        scene.view_layers[0].use_pass_mist = True
        if "Mist" in rl.outputs:
            hc = node("CompositorNodeRGB", "LK_HazeColour")
            hc.outputs[0].default_value = (*haze, 1.0)
            k = node("CompositorNodeMath", "LK_HazeAmount", operation="MULTIPLY", use_clamp=True)
            links.new(rl.outputs["Mist"], k.inputs[0])
            k.inputs[1].default_value = amount
            m = node("CompositorNodeMixRGB", "LK_Haze", blend_type="MIX")
            links.new(k.outputs[0], m.inputs["Fac"])
            links.new(last, m.inputs[1])
            links.new(hc.outputs[0], m.inputs[2])
            last = m.outputs["Image"]

    # the time's grade, in the scene's light: saturation, and the shadows lifted toward blue (never black)
    sat_k, lift = T["grade"]
    g = node("CompositorNodeHueSat", "LK_Saturation")
    setin(g, "Saturation", sat_k)
    links.new(last, g.inputs["Image"])
    last = g.outputs["Image"]
    if any(lift):
        bw = node("CompositorNodeRGBToBW", "LK_Luma")
        links.new(last, bw.inputs[0])
        inv = node("CompositorNodeMath", "LK_Shadows", operation="SUBTRACT", use_clamp=True)
        inv.inputs[0].default_value = 1.0
        links.new(bw.outputs[0], inv.inputs[1])
        col = node("CompositorNodeRGB", "LK_LiftColour")
        col.outputs[0].default_value = (*lift, 1.0)
        last = mix("LK_Lift", "ADD", last, mix("LK_LiftShadows", "MULTIPLY", col.outputs[0], inv.outputs[0]))

    if preset == "off":
        for transform in ("AgX", "Filmic"):
            try:
                vs.view_transform = transform
                break
            except TypeError:
                continue
        vs.exposure = T["exposure"]
        links.new(last, comp.inputs[0])
        return nt

    P = dict(VHS[preset])
    if t == "night":
        P["black"] = NIGHT_BLACK              # UltraVHS's night mode
    H = scene.render.resolution_y * scene.render.resolution_percentage / 100
    k = H / 480.0                             # tape pixels to the picture's
    ex = node("CompositorNodeExposure", "VHS_Exposure")
    setin(ex, "Exposure", T["exposure"])
    links.new(last, ex.inputs["Image"])
    tone = space("VHS_Tonemap", ["Linear Rec.709", "Linear"], list(display))
    links.new(ex.outputs["Image"], tone.inputs[0])
    last = tone.outputs[0]

    # the lens: barrel (zoomed to keep the corners filled), the fringe, the vignette
    lens = node("CompositorNodeLensdist", "VHS_Lens")
    setin(lens, ["Distortion", "Distort"], P["distortion"])
    setin(lens, "Dispersion", P["fringe"] * 0.01)
    setin(lens, ["Fit", "use_fit"], True)
    links.new(last, lens.inputs["Image"])
    ell = node("CompositorNodeEllipseMask", "VHS_VignetteMask")
    if hasattr(ell, "mask_width"):            # its own size (not the node's `width` on the canvas)
        ell.mask_width = ell.mask_height = 1.2
    else:
        setin(ell, "Size", (1.2, 1.2))
    last = mix("VHS_Vignette", "MULTIPLY", lens.outputs["Image"], blur("VHS_VignetteSoft", H * 0.35, H * 0.35, ell.outputs["Mask"]),
               min(1.0, P["vignette"] * 3.1))   # 0.08: the corners at about 75 % of the centre

    # the sensor: less saturation, black lifted (warm by day, a cool blue at night), white short of full
    sat = node("CompositorNodeHueSat", "VHS_Saturation")
    setin(sat, "Saturation", P["saturation"])
    links.new(last, sat.inputs["Image"])
    lev = node("CompositorNodeColorBalance", "VHS_Levels", correction_method="OFFSET_POWER_SLOPE")
    black, white = P["black"], P["white"]
    slope = tuple(w_ - b for w_, b in zip(white, black))
    if hasattr(lev, "offset"):                # properties (4.x), colour inputs later
        lev.offset, lev.slope = black, slope
    else:
        setin(lev, "Offset", (*black, 1.0))
        setin(lev, "Slope", (*slope, 1.0))
    links.new(sat.outputs["Image"], lev.inputs["Image"])

    # the tape: luma soft with the deck's halo beside edges; colour bled wide along the line and shared with the line above
    sep = node("CompositorNodeSeparateColor", "VHS_Split", mode="YCC")
    links.new(lev.outputs["Image"], sep.inputs["Image"])
    soft = blur("VHS_Luma", P["luma_blur"] * k * LUMA_K, P["luma_blur"] * k * LUMA_K * 0.6, sep.outputs[0])
    wide = blur("VHS_Halo", P["sharpen_radius"] * k * HALO_K, 0.0, soft)
    sharp = mix("VHS_Sharpen", "ADD", soft, mix("VHS_HaloDiff", "SUBTRACT", soft, wide), P["sharpen"] * SHARPEN_K)
    join = node("CompositorNodeCombineColor", "VHS_Join", mode="YCC")
    links.new(sharp, join.inputs[0])
    for i in (1, 2):
        c = blur(f"VHS_Chroma{i}", P["chroma_blur"] * k * CHROMA_K, P["chroma_vertical"] * k * 2, sep.outputs[i])
        if P["chroma_shift"]:                 # colour arriving late, to the right
            tr = node("CompositorNodeTranslate", f"VHS_Late{i}")
            setin(tr, "X", P["chroma_shift"] * k)
            links.new(c, tr.inputs["Image"])
            c = tr.outputs["Image"]
        links.new(c, join.inputs[i])
    links.new(sep.outputs[3], join.inputs[3])
    last = join.outputs["Image"]
    if P["noise"] > 0:                        # snow: a fine noise texture
        tex = bpy.data.textures.get("VHS_Snow") or bpy.data.textures.new("VHS_Snow", "NOISE")
        tn = node("CompositorNodeTexture", "VHS_Snow")
        tn.texture = tex
        last = mix("VHS_SnowAdd", "OVERLAY", last, tn.outputs[-1], P["noise"] * 0.3)
    back = space("VHS_Linear", ["sRGB"], ["Linear Rec.709", "Linear"])   # back to linear for a Standard view
    links.new(last, back.inputs[0])
    last = back.outputs[0]
    links.new(last, comp.inputs[0])
    for n in nodes:                           # a Viewer shows it in the compositor's backdrop
        if n.bl_idname == "CompositorNodeViewer":
            links.new(last, n.inputs[0])
    vs.view_transform, vs.exposure = "Standard", 0.0
    if hasattr(vs, "look"):
        vs.look = "None"
    r = scene.render                          # the frame: a camcorder records 4:3 (keep the height)
    r.resolution_x = int(round(r.resolution_y * 4 / 3))
    return nt


def handheld(scene):
    """The hands' slow wander on the active camera: noise on its rotation, two octaves (UltraVHS's Handheld drift)."""
    cam = scene.camera
    if not cam:
        return None
    fps = scene.render.fps / scene.render.fps_base
    cam.keyframe_insert("rotation_euler", frame=scene.frame_start)
    act = cam.animation_data.action
    curves = [c for c in getattr(act, "fcurves", []) if c.data_path == "rotation_euler"]
    if not curves and hasattr(act, "layers"):          # Blender 4.4+: layered actions
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves += [c for c in bag.fcurves if c.data_path == "rotation_euler"]
    amp = {0: HANDHELD["pitch"], 1: HANDHELD["roll"], 2: HANDHELD["yaw"]}   # a camera's X tilts, Y rolls, Z turns
    for c in curves:
        for m in [m for m in c.modifiers if m.type == "NOISE"]:
            c.modifiers.remove(m)
        for octave, (scale, share) in enumerate(((1.0, 1.0), (0.45, 0.4))):
            m = c.modifiers.new("NOISE")
            m.scale = fps / HANDHELD["hz"] * scale
            m.strength = math.radians(amp[c.array_index]) * 2 * share
            m.phase = 10.0 * c.array_index + 37.0 * octave
    return cam


def main():
    a = args()
    scene = bpy.context.scene
    if a["engine"]:
        scene.render.engine = {"cycles": "CYCLES", "eevee": "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in
                               [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"}[a["engine"]]
    made = time_of_day(scene, a["time"], a["windows"])
    composite(scene, a["time"], a["vhs"])
    if a["handheld"]:
        handheld(scene)
    if a["save"] and bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
    print(f"LOOK ok: {a['time']}, VHS {a['vhs']}, {len(made)} window lights")


if __name__ == "__main__":
    main()

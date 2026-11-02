"""Mtree's tree growth in plain numpy Python, after the core of Maxime Herpin's Modular Tree 4 (`m_tree`, MIT:
https://github.com/MaximeHerpin/modular_tree; steven-ray/modular_tree, the fork the user pointed at, is its build for
Blender 3.x). The add-on compiled that core as C++ against one Blender's Python at a time; this is the same growth
written for Blender 4.2's and 5.x's own Python with nothing to build. The tree family (families/tree.py) meshes what
grows here and hangs the leaves.

A tree is nodes: each a direction, a length and a radius, with children hung at a position along it (the first child
carries the branch on, the others leave it as side branches). Functions grow it in turn, each on what the one before
made, every node remembering which function made it (`creator`):

- `trunk`: the stem from the ground, its radius tapering by `shape`, drifting by `randomness`, pulled up.
- `branches`: new branches on the parent function's nodes between `start` and `end` of each parent branch's length,
  one every 1/`density` metres, turned round the parent by the phyllotaxis angle, leaving at `angle` degrees; each
  grows a node at a time (1/`resolution` metres) with randomness, up attraction and flatness, splits in two with
  `split` chance, breaks off with `break_chance`, keeps off the floor, and gravity bends every branch of the function
  as it grows (its weight, its age, `stiffness` holding it).
- `pipe_radius`: every radius from its children's (the pipe model: r = (Σ r_child^p)^(1/p) + a little a metre), so
  the twigs end at `end_radius` and the trunk is as thick as what it carries.

Properties that vary along a parent branch (a branch's length, its start angle, its radius against the parent's,
its randomness) take a number, [min, max] (rolled for each branch) or {"from": a, "to": b, "power": p} (from the
start of the parent to its end). Everything is metres and degrees. The same seed grows the same tree.
"""
import math

import numpy as np

UP = np.array([0.0, 0.0, 1.0])


def _unit(v):
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-12 else np.asarray(v, float)


def orthogonal(v):
    """A unit vector at right angles to v (Mtree's choice: from x, or from y when v is nearly vertical)."""
    tmp = np.array([1.0, 0.0, 0.0]) if abs(v[2]) < 0.95 else np.array([0.0, 1.0, 0.0])
    return _unit(np.cross(tmp, v))


def project(v, n):
    """v with its part along the unit normal n taken away (projected on n's plane)."""
    return v - float(np.dot(v, n)) * n


def axis_angle(axis, angle):
    """The rotation matrix (3 x 3) turning `angle` radians round `axis`."""
    a = _unit(np.asarray(axis, float))
    c, s = math.cos(angle), math.sin(angle)
    K = np.array([[0.0, -a[2], a[1]], [a[2], 0.0, -a[0]], [-a[1], a[0], 0.0]])
    return np.eye(3) * c + s * K + (1 - c) * np.outer(a, a)


def look_at(direction):
    """The rotation taking +Z onto `direction` (Mtree's get_look_at_rot)."""
    axis = np.cross(UP, direction)
    s, c = float(np.linalg.norm(axis)), float(np.dot(UP, direction))
    angle = math.atan2(s, c)
    axis = UP if angle < 0.01 else axis / s
    return axis_angle(axis, angle)


def lerp(a, b, t):
    return a + (b - a) * t


class Rng:
    """Mtree's generator: numbers 0 to 1 and random vectors with each part -1 to 1 (`flatness` squeezes z)."""

    def __init__(self, seed):
        self.r = np.random.default_rng(int(seed) & 0xffffffff)

    def get(self):
        return float(self.r.random())

    def vec(self, flatness=0.0):
        v = self.r.uniform(-1.0, 1.0, 3)
        v[2] *= 1.0 - flatness
        return v


def prop(x):
    """A property along a parent branch as a function (factor 0 to 1 along it, the rng) -> float: a number, [min, max]
    rolled each time, or {"from": a, "to": b, "power": p} (Mtree's constant, random and simple-curve properties)."""
    if callable(x):
        return x
    if isinstance(x, dict):
        a = float(x.get("from", x.get("min", 1.0)))
        b = float(x.get("to", x.get("max", a)))
        p = float(x.get("power", 1.0))
        return lambda f, r: lerp(a, b, min(max(f, 0.0), 1.0) ** p if p > 0 and p != 1 else min(max(f, 0.0), 1.0))
    if isinstance(x, (list, tuple)):
        a, b = float(x[0]), float(x[-1])
        return lambda f, r: lerp(a, b, r.get())
    v = float(x)
    return lambda f, r: v


class Node:
    """A piece of a branch: where it points, how long and how thick, and what hangs off it. `children` is a list of
    (node, position in this node 0 to 1); the first child carries the branch on from this node's end."""
    __slots__ = ("direction", "tangent", "length", "radius", "children", "creator", "info")

    def __init__(self, direction, parent_tangent, length, radius, creator):
        self.direction = _unit(np.asarray(direction, float))
        t = project(np.asarray(parent_tangent, float), self.direction)
        self.tangent = _unit(t) if np.linalg.norm(t) > 1e-9 else orthogonal(self.direction)
        self.length = float(length)
        self.radius = float(radius)
        self.children = []
        self.creator = int(creator)
        self.info = None

    def is_leaf(self):
        return not self.children

    def end(self, position):
        return position + self.direction * self.length


class Stem:
    __slots__ = ("node", "position")

    def __init__(self, node, position):
        self.node, self.position = node, np.asarray(position, float)


class BranchInfo:
    """What a growing branch node remembers (Mtree's BranchGrowthInfo)."""
    __slots__ = ("desired", "current", "origin_radius", "weight", "deviation", "age", "inactive", "position")

    def __init__(self, desired, origin_radius, position, current=0.0):
        self.desired, self.origin_radius, self.position, self.current = float(desired), float(origin_radius), np.asarray(position, float), float(current)
        self.weight, self.deviation, self.age, self.inactive = 0.0, 0.0, 0.0, False


# ---- walking the tree ------------------------------------------------------------------------------------------------

def walk(stems):
    """Every node with its start position, depth first, as (node, position, parent node or None)."""
    out = []
    for st in stems:
        stack = [(st.node, st.position, None)]
        while stack:
            node, pos, parent = stack.pop()
            out.append((node, pos, parent))
            for child, pip in reversed(node.children):
                stack.append((child, pos + node.direction * node.length * pip, node))
    return out


def select(stems, creator):
    """The nodes a function made, by branch (Mtree's select_from_tree): lists of (node, position) in order along each
    chain of first children, a new list wherever a side child begins."""
    sel = [[]]

    def rec(node, pos):
        if node.creator == creator:
            sel[-1].append((node, pos))
        first = True
        for child, pip in node.children:
            if not first:
                sel.append([])
            first = False
            rec(child, pos + node.direction * node.length * pip)

    for st in stems:
        rec(st.node, st.position)
    return [b for b in sel if b]


def branch_length(node):
    """The length of the branch from this node along its first children to the tip."""
    total = 0.0
    while True:
        total += node.length
        if not node.children:
            return total
        node = node.children[0][0]


def splines(stems):
    """The tree as splines for a mesher (Mtree's BasicMesher): each a chain of first children, as dicts with `P`
    (k, 3) points, `R` (k) radii, `nodes` (the node each point starts; the tip point repeats the last), `parent` (the
    node a side branch leaves, None for a stem) and `parent_radius` there."""
    out = []

    def rec(node, pos, parent, parent_radius):
        sp = {"P": [], "R": [], "nodes": [], "parent": parent, "parent_radius": parent_radius}
        out.append(sp)
        while True:
            sp["P"].append(pos)
            sp["R"].append(node.radius)
            sp["nodes"].append(node)
            if not node.children:
                sp["P"].append(node.end(pos))
                sp["R"].append(node.radius)
                sp["nodes"].append(node)
                break
            for child, pip in node.children[1:]:
                rec(child, pos + node.direction * node.length * pip, node, node.radius)
            node, pos = node.children[0][0], node.end(pos)

    for st in stems:
        rec(st.node, st.position, None, 0.0)
    for sp in out:
        sp["P"], sp["R"] = np.array(sp["P"], float), np.array(sp["R"], float)
    return out


# ---- the functions ------------------------------------------------------------------------------------------------------

def trunk(stems, seed, length=10.0, start_radius=0.3, end_radius=0.05, shape=0.5, resolution=3.0, randomness=0.1,
          up_attraction=0.6, creator=0, origin=(0.0, 0.0, 0.0), direction=UP):
    """A stem of `length` from `origin` (Mtree's TrunkFunction), a node every 1/resolution metres, its radius from
    start to end by `shape` (1 straight, under 1 keeps it thick longer), each node's direction the last one's plus
    randomness and a pull up. `direction` leans it (several stems make a clump)."""
    r = Rng(seed)
    seg = 1.0 / (resolution + 0.001)
    d = _unit(np.asarray(direction, float))
    first = Node(d, orthogonal(d), seg, start_radius, creator)
    cur = first
    n = int(resolution * length)
    for i in range(n):
        if i == n - 1:
            seg = length - i * seg
        factor = (i / n) ** shape
        radius = lerp(start_radius, end_radius, factor)
        direction = cur.direction + r.vec() * (randomness / (resolution + 0.001)) + UP * (up_attraction / (resolution + 0.001))
        child = Node(direction, first.tangent, seg, radius, creator)
        cur.children.append((child, 1.0))
        cur = child
    stems.append(Stem(first, origin))
    return first


def _avoid_floor(position, direction, parent_length):
    """Bends a direction heading for the ground back up as it nears it (in place); True when it would go under."""
    if direction[2] < 0:
        direction[2] -= direction[2] * 2 / (2 + position[2])
    return (position + direction)[2] * parent_length * 4 < 0


def branches(stems, seed, parent, creator, start=0.1, end=1.0, density=2.0, length=9.0, start_radius=0.4, end_radius=0.05,
             break_chance=0.01, resolution=3.0, randomness=0.4, phyllotaxis=137.5, gravity=10.0, stiffness=0.1,
             up_attraction=0.25, flatness=0.5, split_radius=0.9, angle=45.0, split_angle=45.0, split=0.5, floor=True):
    """Branches on the nodes the function `parent` made (Mtree's BranchFunction), made by `creator`. `length`,
    `start_radius`, `randomness` and `angle` are properties along the parent branch (prop); `start_radius` is a share of
    the parent node's radius there, `end_radius` of the branch's own first radius at its tip, `split_radius` of the
    node's radius at a split. `density` branches a metre, `gravity` bends them down as they grow against `stiffness`."""
    r = Rng(seed)
    P = {"length": prop(length), "start_radius": prop(start_radius), "randomness": prop(randomness), "angle": prop(angle)}
    origins = _origins(stems, r, parent, creator, start, end, density, resolution, phyllotaxis, P)
    _grow(origins, r, creator, end_radius, break_chance, resolution, up_attraction, flatness, split, split_angle,
          split_radius, gravity, stiffness, P["randomness"], floor)
    return origins


def _origins(stems, r, parent, creator, start, end, density, resolution, phyllotaxis, P):
    origins = []
    origins_dist = 1.0 / (density + 0.001)
    for branch in select(stems, parent):
        total = branch_length(branch[0][0])
        abs_start, abs_end = start * total, end * total
        current = 0.0
        dist_to_next = abs_start
        tangent = orthogonal(branch[0][0].direction)
        for node, node_pos in branch:
            if not node.children:
                continue                        # the tip: a child there would carry the branch on, not leave it
            rot = axis_angle(node.direction, math.radians(phyllotaxis + (r.get() - 0.5) * 2))
            if dist_to_next > node.length:
                dist_to_next -= node.length
                current += node.length
                continue
            remaining = node.length - dist_to_next
            current += dist_to_next
            to_create = int(remaining / origins_dist) + 1
            pip = dist_to_next / node.length
            pip_step = origins_dist / node.length
            for i in range(to_create):
                if current > abs_end:
                    break
                factor = (current - abs_start) / max(0.001, abs_end - abs_start)
                tangent = _unit(project(rot @ tangent, node.direction))
                child_dir = _unit(lerp(node.direction, tangent, P["angle"](factor, r) / 90.0))
                child_radius = node.radius * P["start_radius"](factor, r)
                want = P["length"](factor, r)
                node_len = min(want, 1.0 / (resolution + 0.001))
                child = Node(child_dir, node.tangent, node_len, child_radius, creator)
                node.children.append((child, pip))
                child.info = BranchInfo(want - node_len, child_radius, node_pos + node.direction * node.length * pip, child.length)
                if want - node_len > 1e-3:
                    origins.append(child)
                pip += pip_step
                if i > 0:
                    current += origins_dist
            remaining -= (to_create - 1) * origins_dist
            dist_to_next = origins_dist - remaining
    return origins


def _grow(origins, r, creator, end_radius, break_chance, resolution, up_attraction, flatness, split, split_angle,
          split_radius, gravity, stiffness, randomness, floor):
    from collections import deque
    queue = deque(origins)
    batch = len(queue)
    while queue:
        if batch == 0:
            batch = len(queue)
            for o in origins:
                _gravity(o, gravity, stiffness, resolution)
        node = queue.popleft()
        _grow_once(node, r, queue, creator, end_radius, break_chance, resolution, up_attraction, flatness, split,
                   split_angle, split_radius, randomness, floor)
        batch -= 1


def _grow_once(node, r, queue, creator, end_radius, break_chance, resolution, up_attraction, flatness, split, split_angle,
               split_radius, randomness, floor):
    if r.get() * resolution < break_chance:
        node.info.inactive = True
        return
    info = node.info
    factor = info.current / max(info.desired, 1e-9)
    child_radius = lerp(info.origin_radius, info.origin_radius * end_radius, factor)
    child_length = min(1.0 / resolution, info.desired - info.current)
    # the main child: on along the branch, wandering, pulled up, flattened
    rand_dir = _unit(r.vec(flatness)) + UP * up_attraction
    child_dir = node.direction + rand_dir * randomness(factor, r) / resolution
    if floor and _avoid_floor(info.position, child_dir, node.length):
        info.inactive = True
        return
    child_dir = _unit(child_dir)
    child = Node(child_dir, node.tangent, child_length, child_radius, creator)
    node.children.append((child, 1.0))
    current = info.current + child_length
    child.info = BranchInfo(info.desired, info.origin_radius, info.position + child_dir * child_length, current)
    if current < info.desired:
        queue.append(child)
    if r.get() * resolution < split:
        sd = r.vec()
        sd = np.cross(sd, node.direction) + UP * up_attraction * flatness
        flat_normal = _unit(np.cross(np.cross(UP, node.direction), node.direction))
        sd -= float(np.dot(sd, flat_normal)) * flatness * flat_normal
        if floor:
            _avoid_floor(info.position, sd, node.length)
        sd = _unit(lerp(node.direction, sd, split_angle / 90.0))
        pip = r.get()
        child2 = Node(sd, node.tangent, child_length, node.radius * split_radius, creator)
        node.children.append((child2, pip))
        child2.info = BranchInfo(info.desired, info.origin_radius * split_radius, info.position + node.direction * node.length * pip + sd * child_length, current)
        if current < info.desired:
            queue.append(child2)


def _gravity(origin, gravity, stiffness, resolution):
    """One pass of gravity over a branch and all it carries (Mtree's apply_gravity_to_branch): each node's weight is
    its length and its children's, the heavier and the more level a node the more it turns down, less the older it is
    and the further it has already bent (stiffness); the turn carries down the branch; then every position is
    brought up to date."""
    # weights, children first
    order = []
    stack = [origin]
    while stack:
        n = stack.pop()
        order.append(n)
        for c, _ in n.children:
            stack.append(c)
    for n in reversed(order):
        w = n.length
        for c, _ in n.children:
            w += c.info.weight
        n.info.weight = w
    # the bend, carried down from each node to all below it
    stack = [(origin, np.eye(3))]
    while stack:
        n, R = stack.pop()
        info = n.info
        horizontality = 1.0 - abs(n.direction[2])
        info.age += 1.0 / resolution
        disp = horizontality * math.sqrt(max(info.weight, 0.0)) * gravity / resolution / resolution / 1000.0 / (1.0 + info.age)
        disp *= math.exp(-abs(info.deviation / resolution * stiffness))
        info.deviation += disp
        tangent = np.cross(n.direction, -UP)
        if np.linalg.norm(tangent) > 1e-9 and disp != 0.0:
            R = axis_angle(tangent, disp) @ R
        n.direction = _unit(R @ n.direction)
        for c, _ in n.children:
            stack.append((c, R))
    # positions
    stack = [(origin, origin.info.position)]
    while stack:
        n, pos = stack.pop()
        n.info.position = pos
        for c, pip in n.children:
            stack.append((c, pos + n.direction * n.length * pip))


def pipe_radius(stems, end_radius=0.01, constant_growth=0.01, power=2.0, only=None):
    """Every radius from its children's, tips first (Mtree's PipeRadiusFunction): a tip is `end_radius`, a node
    (Σ children^power)^(1/power) plus constant_growth × its length / 100. `only`: a set of creators to leave alone
    (their radii as grown: a pollarded limb's knuckle, say)."""
    for st in stems:
        order = []
        stack = [st.node]
        while stack:
            n = stack.pop()
            order.append(n)
            stack.extend(c for c, _ in n.children)
        for n in reversed(order):
            if only and n.creator in only:
                continue
            if not n.children:
                n.radius = end_radius
            else:
                n.radius = sum(c.radius ** power for c, _ in n.children) ** (1.0 / power) + constant_growth * n.length / 100.0


def bounds(stems):
    """(lowest, highest) corners of every node's start and end."""
    pts = []
    for node, pos, _ in walk(stems):
        pts.append(pos)
        pts.append(node.end(pos))
    pts = np.array(pts)
    return pts.min(0), pts.max(0)


def count(stems):
    return len(walk(stems))

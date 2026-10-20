// The director's stage: a scene's level in greybox (the same plan the Unreal importer builds), the cast as previs
// figures, and the player's eye. Plays a scene's clips on its elastic timeline with blends, seams and camera moves;
// renders storyboard frames; finds which body parts the player can see; exports the blocking as glTF for Unreal.
import * as THREE from "three";
import * as M from "./motion.js";
import { BodyFigure } from "./bodies.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";

// The studio's CC0 library (Content/Studio/Library, docs/ASSETS.md): what's been fetched, from /api/library. A prop
// tagged art:<ref> shows that mesh in its block (the block stays, invisible, for the visibility test); mat:<ref> puts
// that texture set on a block, tiled by real metres. Anything not fetched stays a grey block.
export const LIBRARY = { meshes: new Set(), textures: {} };
export async function loadAssetLibrary() {
  try {
    const r = await (await fetch("/api/library")).json();
    LIBRARY.meshes = new Set(r.meshes || []); LIBRARY.textures = r.textures || {};
  } catch (e) { /* no library: blocks */ }
  return LIBRARY;
}
const meshCache = {}, matCache = {};
function libMesh(ref) {
  if (!meshCache[ref]) meshCache[ref] = new GLTFLoader().loadAsync(`/library/meshes/${ref}.glb`).then(g => g.scene).catch(() => null);
  return meshCache[ref];
}
function libMaterial(ref) {
  if (matCache[ref]) return matCache[ref];
  const meta = LIBRARY.textures[ref], tl = new THREE.TextureLoader(), maps = meta.maps || {};
  const tex = (k, srgb) => {
    if (!maps[k]) return null;
    const t = tl.load(`/library/textures/${ref}/${maps[k]}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.map = tex("albedo", true); m.normalMap = tex("normal"); m.roughnessMap = tex("rough"); m.aoMap = tex("ao");
  if (meta.normal === "dx" && m.normalMap) m.normalScale.set(1, -1);     // DirectX normals: green flipped
  m.userData.tile = meta.tile_m || 1;
  return (matCache[ref] = m);
}
function tileUVs(geo, w, h, d, tile) {     // a box's UVs in metres / tile, so a texture keeps its real size on any block
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];  // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  geo.setAttribute("uv1", uv.clone());   // the ao map's channel
}

const EYE = 1.65;
// First person: the camera IS the player's eye. It stands where the player can stand, at the stance's eye height,
// looks within the neck's reach, and never changes lens (docs/DIRECTING.md §1). A shot size is a framing reached by
// DISTANCE: how close the actor comes to the eye (Hall's proxemic zones), at the game's one field of view.
export const EYES = { stand: 1.65, crouch: 1.05, kneel: 1.2, sit: 1.15, lie: 0.3, hide: 1.6 };
export const FOV_H = 90;               // the game's horizontal field of view (game.fov overrides)
export const LEAN = 0.35, ZOOM = 0.15, PITCH = 75;   // how far the player leans in (push), the most a held focus narrows, the neck
export function vfov(hfov, aspect) { return 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / aspect) * 180 / Math.PI; }
export const PLAYER_FOV = vfov(FOV_H, 16 / 9);
export const SHOTS = {
  ecu: { near: 0, far: 0.3, dist: "under 0.3 m", zone: "intimate (a violation)", use: "in your face: a breath on you, a bite, the grab, the eye at the keyhole" },
  cu: { near: 0.3, far: 0.55, dist: "0.3-0.55 m", zone: "intimate", use: "a face leaning into yours: a whisper, a threat said quietly, a confession, a kiss" },
  mcu: { near: 0.55, far: 0.9, dist: "0.55-0.9 m", zone: "personal (arm's length)", use: "head and shoulders: talking close, a hand on your shoulder" },
  ms: { near: 0.9, far: 1.6, dist: "0.9-1.6 m", zone: "personal to social", use: "waist up: across a table, a conversation, someone blocking the way" },
  fs: { near: 1.6, far: 3, dist: "1.6-3 m", zone: "social", use: "the whole body: in the doorway, across the room, the pose reads" },
  ws: { near: 3, far: 1e9, dist: "over 3 m", zone: "public", use: "small in the room: at the end of the corridor, in the window, the empty frame" },
  insert: { near: 0.2, far: 0.7, dist: "0.2-0.7 m (an object)", zone: "within reach", use: "an object in your hands or on the table in front of you: the player looks down at it" },
  pov_down: { near: 0, far: 1e9, dist: "-", zone: "-", use: "the player looks down: their hands, a body at their feet, being dragged" },
  pov_up: { near: 0, far: 1e9, dist: "-", zone: "-", use: "the player looks up: something on the ceiling, someone looming over a seated or fallen player" },
};
export function shotFor(d) { return ["ecu", "cu", "mcu", "ms", "fs", "ws"].find(k => d < SHOTS[k].far); }
export const SEAM_SECS = { none: 0, blink: 0.2, glance: 1, flicker: 0.4, occlude: 0.8, cutaway: 1.5, turn: 0, stumble: 1, dip: 2, jcut: 0, heartbeat: 0.6 };

export const s2t = (x, y, z) => new THREE.Vector3(x, z, -y);       // story (x east, y north, z up) -> three (y up)
const yawToThree = rot => (rot + 90) * Math.PI / 180;               // character +Z faces the spot's rot

export function clipSecs(c) { return c.dur ? +c.dur : c.dur_tts ? +c.dur_tts : Math.max(1.5, (c.en || "").length / 12 + 0.6); }
export function version(sc) { const v = sc && sc.variants && sc.pick && sc.variants[sc.pick]; return v ? Object.assign({}, sc, v) : (sc || {}); }

// ---- the figure -------------------------------------------------------------------------------------------------
const RADIUS = { spine_01: 0.12, spine_02: 0.12, spine_03: 0.13, neck_01: 0.05, head: 0.05, clavicle_l: 0.05, clavicle_r: 0.05,
  upperarm_l: 0.05, upperarm_r: 0.05, lowerarm_l: 0.042, lowerarm_r: 0.042, hand_l: 0.035, hand_r: 0.035, hand_end_l: 0.03, hand_end_r: 0.03,
  thigh_l: 0.075, thigh_r: 0.075, calf_l: 0.055, calf_r: 0.055, foot_l: 0.045, foot_r: 0.045, ball_l: 0.04, ball_r: 0.04 };

export class Figure {
  constructor(lib, height, color = 0xc8c2b6) {
    this.lib = lib; this.height = height || 1.7;
    this.group = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: 0x15120e });
    this.bones = [];
    for (const j of lib.joints) {
      if (!j.parent || j.name === "head_end") continue;
      const r = RADIUS[j.parent] || 0.04;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1, 10), this.mat);
      m.userData = { a: j.parent, b: j.name, joint: j.name };
      this.group.add(m); this.bones.push(m);
    }
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), this.mat);
    this.group.add(this.headMesh);
    this.pos = null;
  }
  setColor(c) { this.mat.color.set(c); }
  update(pos) {                                   // pos: joint -> Vector3 in character space
    this.pos = pos;
    const up = new THREE.Vector3(0, 1, 0);
    for (const m of this.bones) {
      const a = pos[m.userData.a], b = pos[m.userData.b];
      if (!a || !b) { m.visible = false; continue; }
      m.visible = true;
      const d = b.clone().sub(a), len = d.length();
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, Math.max(0.001, len), 1);
      m.quaternion.setFromUnitVectors(up, d.normalize());
    }
    if (pos.head && pos.head_end) this.headMesh.position.copy(pos.head).lerp(pos.head_end, 0.45);
  }
  jointWorld(name) { const p = this.pos && this.pos[name]; return p ? this.group.localToWorld(p.clone()) : null; }
  headWorld() { return this.jointWorld("head") ? this.jointWorld("head").lerp(this.jointWorld("head_end"), 0.4) : this.group.position.clone().setY(1.55); }
}

// ---- the stage --------------------------------------------------------------------------------------------------
export class Stage {
  constructor(container, lib) {
    this.lib = lib;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050506);
    this.scene.fog = new THREE.Fog(0x050506, 4, 16);
    this.camera = new THREE.PerspectiveCamera(PLAYER_FOV, 16 / 9, 0.05, 60);
    this.scene.add(new THREE.AmbientLight(0x8a8f9a, 0.22));
    this.scene.add(new THREE.HemisphereLight(0x9aa0b0, 0x1a1410, 0.25));
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.lights = []; this.solid = []; this.cast = {}; this.things = {}; this.level = null;
    this.bodies = {}; this.defaultBody = null;      // loaded body templates by file name (app.js fills them)
    this.free = null;                               // free (orbit) camera state when inspecting from outside
    this.look = { yaw: 0, pitch: 0 };               // the player's own look inside a soft cone
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }
  resize() {
    const w = this.container.clientWidth || 640, h = this.container.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setWorld(plan, story, level) {
    this.story = story; this.plan = plan; this.level = level;
    this.things = plan.things;
    this.world.clear(); this.lights = []; this.solid = []; this.cast = {}; this.pending = [];
    const mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x3a342d, roughness: 1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 1 }),
      door: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),
      prop: new THREE.MeshStandardMaterial({ color: 0x5d6f86, roughness: 0.8 }),
      use: new THREE.MeshStandardMaterial({ color: 0x4f8a5c, roughness: 0.8 }),
    };
    for (const p of plan.pieces) {
      if (p.level !== level) continue;
      if (["wall", "floor", "ceiling", "door", "mesh"].includes(p.kind)) {
        if (p.tags.includes("hidden")) continue;
        const [w, d, h] = p.size;
        const geo = p.shape === "cyl" ? new THREE.CylinderGeometry(w / 2, w / 2, h, 16) :
                    p.shape === "sphere" ? new THREE.SphereGeometry(w / 2, 16, 12) : new THREE.BoxGeometry(w, h, d);
        let mat = p.kind === "mesh" ? (p.tags.some(t => t.startsWith("use:")) ? mats.use : mats.prop) : mats[p.kind];
        const matRef = (p.tags.find(t => t.startsWith("mat:")) || "").slice(4), artRef = (p.tags.find(t => t.startsWith("art:")) || "").slice(4);
        if (matRef && LIBRARY.textures[matRef] && p.shape === "box") { mat = libMaterial(matRef); tileUVs(geo, w, h, d, mat.userData.tile); }
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(s2t(...p.pos));
        m.rotation.y = p.yaw * Math.PI / 180;
        m.userData = { id: p.id, kind: p.kind, art: artRef || null };
        this.world.add(m); this.solid.push(m);
        if (artRef && LIBRARY.meshes.has(artRef)) this.pending.push(this.dress(m, artRef, [w, h, d], p.tags.includes("real")));
      } else if (p.kind === "light") {
        const kind = (p.d && p.d.kind) || "bulb";
        const [col, inten, dist] = { bulb: [0xffc98a, 2.2, 7], candle: [0xffa84a, 1.0, 3.5], lamp: [0xffd2a0, 1.6, 5], fire: [0xff8a3a, 3, 9] }[kind] || [0xffc98a, 2, 7];
        const l = new THREE.PointLight(col, (p.d && p.d.lit === false) ? 0 : inten, dist, 1.6);
        l.position.copy(s2t(...p.pos));
        l.userData = { id: p.id, room: p.room, base: l.intensity, flicker: (p.d && p.d.flicker) || 0 };
        this.world.add(l); this.lights.push(l);
      } else if (p.kind === "person") {
        const cid = (p.tags.find(t => t.startsWith("cast:")) || "").slice(5);
        const f = this.makeFigure(Object.assign({}, (story.cast || {})[cid] || {}, { height: p.size[2] }), 0x9a8fa8);
        f.update(M.fk(this.lib, M.clonePose(this.lib.poses.idle), p.size[2]).pos);
        f.group.position.copy(s2t(...p.pos)); f.group.rotation.y = yawToThree(p.yaw);
        f.group.visible = !p.tags.includes("hidden");
        this.world.add(f.group);
      }
    }
    for (const [cid, c] of Object.entries(story.cast || {})) {
      const f = this.makeFigure(c);
      f.group.visible = false;
      this.world.add(f.group); this.cast[cid] = f;
    }
  }

  bodyFor(c) {
    const file = (c && c.previs_body) || (this.story && this.story.game && this.story.game.previs_body) || this.defaultBody;
    return file && file !== "capsules" ? this.bodies[file] : null;
  }
  makeFigure(c, color) {
    const h = +(c.height || 1.7), tpl = this.bodyFor(c);
    if (tpl) {
      const f = new BodyFigure(this.lib, h, tpl, { color, shape: c.shape });
      if (f.ok) return f;
      console.warn("body file: bones not found:", f.missing.join(", "));
    }
    return new Figure(this.lib, h, color);
  }

  // ---- a scene's timeline (elastic: every length comes from its clip) ----------------------------------------
  timeline(sc) {
    const v = version(sc), clips = v.clips || [], segs = [];
    let t = 0;
    clips.forEach((c, i) => {
      if (i && c.seam && SEAM_SECS[c.seam.kind]) { segs.push({ type: "seam", start: t, end: t + SEAM_SECS[c.seam.kind], seam: c.seam, i }); t += SEAM_SECS[c.seam.kind]; }
      const d = clipSecs(c);
      segs.push({ type: "clip", start: t, end: t + d, dur: d, clip: c, i }); t += d;
      const ev = c.event;
      if (ev) { segs.push({ type: "event", start: t, end: t + (+ev.secs || 3), event: ev, clip: c, i }); t += +ev.secs || 3; }
    });
    const hold = (v.hold && +v.hold.max) ? +v.hold.max / 2 : 0;
    if (hold) { segs.push({ type: "hold", start: t, end: t + hold }); t += hold; }
    const last = {};                                  // each actor starts a clip where their previous clip left them
    for (const c of clips) {
      this.resolveMoves(v, c);
      Object.defineProperty(c, "_startMove", { value: (last[c.who] || new THREE.Vector3()).clone(), enumerable: false, writable: true, configurable: true });
      const moved = ((c.body && c.body.block) || []).filter(k => k.moveVec);
      if (moved.length) last[c.who] = moved[moved.length - 1].moveVec.clone();
    }
    return { segs, total: t, v };
  }
  resolveMoves(v, c) {             // blocking keys that `move` to a spot: the travel in the actor's own frame
    const keys = c.body && c.body.block; if (!keys) return;
    const spot = this.things[(v.stage || {})[c.who]]; if (!spot) return;
    const a = (spot.yaw + 90) * Math.PI / 180;
    for (const k of keys) {
      if (!k.move || !this.things[k.move]) { delete k.moveVec; continue; }
      const tg = this.things[k.move].pos, dx = tg[0] - spot.pos[0], dy = tg[1] - spot.pos[1];
      const w = new THREE.Vector3(dx, 0, -dy);                     // story -> three, then into the actor's frame
      w.applyAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      Object.defineProperty(k, "moveVec", { value: w, enumerable: false, writable: true, configurable: true });
    }
  }

  // the body of clip c at local time t (seconds), in its actor's frame
  clipPose(c, t, dur, files) {
    const lib = this.lib, body = c.body || {}, h = +((this.story.cast || {})[c.who] || {}).height || 1.7;
    const u = Math.min(1, Math.max(0, t / Math.max(0.001, dur)));
    let pos;
    const file = body.file && files && files[body.file];
    if (file) {
      const src = M.fitTime(body.fit, M.remap(body.mods, u, dur), dur, file.pos.length / (file.fps || 30));
      pos = M.sampleBaked(file, src).pos;
      const k = file.height ? h / file.height : 1;                 // Kimodo's body is 1.76 m: scale to the cast member
      for (const n in pos) pos[n].multiplyScalar(k);
      if (c._startMove) for (const n in pos) pos[n].add(c._startMove);   // where the last clip left them (its walk is in the file)
    } else {
      const keys = body.block && body.block.length ? body.block : [{ at: 0, pose: "idle" }];
      const p = M.evalBlock(lib, keys, M.remap(body.mods, u, dur) * dur, dur, c._startMove);
      const br = Math.sin(t * 2.2) * 0.012;                        // breathing, so nothing is ever a statue
      p.q.spine_02.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), br));
      pos = M.fk(lib, p, h).pos;
    }
    if ((body.mods || []).some(m => m.type === "mirror")) pos = M.mirrorPositions(pos);
    return pos;
  }

  // everything at scene time T: who stands where in what pose, the camera, the cover (black), the subtitle
  stateAt(tl, T, files, look = { yaw: 0, pitch: 0 }) {
    const v = tl.v, segs = tl.segs;
    let seg = segs.find(s => T >= s.start && T < s.end) || segs[segs.length - 1];
    const clipSeg = seg && (seg.type === "clip" ? seg : [...segs].reverse().find(s => s.type === "clip" && s.start <= T)) || segs.find(s => s.type === "clip");
    const out = { seg, clipSeg, black: 0, sub: null, ja: null, who: null, poses: {}, reach: {}, cam: {} };
    if (!clipSeg) return out;
    const c = clipSeg.clip, local = Math.min(clipSeg.dur, T - clipSeg.start);
    // poses: the speaking clip drives its actor; others idle; blends at clip starts
    for (const who of Object.keys(v.stage || {})) {
      const mine = segs.filter(s => s.type === "clip" && s.clip.who === who);
      const cur = [...mine].reverse().find(s => s.start <= T) || mine[0];
      let pos;
      if (!cur) pos = this.clipPose({ who, body: { block: [{ at: 0, pose: "idle" }] } }, T, 1, files);
      else {
        const lt = Math.min(cur.dur, Math.max(0, T - cur.start));
        pos = this.clipPose(cur.clip, lt, cur.dur, files);
        const prev = mine[mine.indexOf(cur) - 1];
        const b = cur.clip.body || {}, win = b.bridge ? +(b.bridge.secs || 0.6) : (b.blend ?? 0.25);
        if (prev && T - cur.start < win && win > 0) {
          const from = this.clipPose(prev.clip, prev.dur, prev.dur, files);
          const w = M.EASES.inout(Math.max(0, (T - cur.start)) / win);
          pos = M.blendPositions(this.lib, from, pos, w, +(this.story.cast[who] || {}).height || 1.7);
        }
      }
      out.poses[who] = pos;
      const r = cur && (cur.clip.body || {}).reach;   // a hand locked onto something: the IK layer over the animation
      if (r && r.to) {
        const u = Math.min(1, Math.max(0, (T - cur.start) / Math.max(0.001, cur.dur)));
        const at = +(r.at ?? 0.5), from = +(r.from ?? Math.max(0, at - 0.25)), until = +(r.until ?? 1);
        const w = u < from ? 0 : u < at ? M.EASES.inout((u - from) / Math.max(1e-3, at - from)) : u <= until ? 1 : Math.max(0, 1 - (u - until) / 0.1);
        const tg = this.reachTarget(r.to, tl.v);
        if (tg && w > 0) out.reach[who] = { hand: r.hand || "right", target: tg, w, offset: r.offset };
      }
    }
    if (seg.type === "clip") { out.sub = c.en; out.ja = c.ja; out.who = c.who; }
    if (seg.type === "seam") {
      const k = seg.seam.kind, u = (T - seg.start) / (seg.end - seg.start);
      if (k === "blink") out.black = Math.sin(u * Math.PI);
      if (k === "dip") out.black = Math.min(1, Math.sin(u * Math.PI) * 1.6);
      if (k === "heartbeat") out.black = 0.35 * Math.sin(u * Math.PI);
      if (k === "flicker") out.flicker = 1;
      if (k === "glance" || k === "cutaway") out.glance = { target: seg.seam.look, w: k === "cutaway" ? 1 : Math.sin(u * Math.PI), cut: k === "cutaway" };
      if (k === "stumble") out.shake = 1.2 * Math.sin(u * Math.PI);
    }
    if (seg.type === "event") { out.event = seg.event; out.sub = seg.event.prompt || seg.event.type; }
    // camera: the player's eye at the view spot; the lens from the clip's shot and cam
    const cam = Object.assign({}, v.camera || {}, c.cam || {});
    const u = local / Math.max(0.001, clipSeg.dur);
    // the lens never changes: only a held focus (zoom, at most 15 %) narrows it; push is the player leaning in
    const fov = vfov(+((this.story && this.story.game && this.story.game.fov) || FOV_H), this.camera.aspect || 16 / 9) * (1 - Math.min(ZOOM, +(cam.zoom || 0)) * u);
    out.cam = { fov, lean: Math.min(LEAN, +(cam.push || 0)) * u, roll: +(cam.roll || 0), shake: +(cam.shake || 0) + (out.shake || 0), look: cam.look || (v.camera || {}).look, mode: (v.camera || {}).mode || "free",
                cone: (v.camera || {}).cone || [30, 18], userLook: look, pov: c.shot === "pov_down" ? -35 : c.shot === "pov_up" ? 30 : 0 };
    return out;
  }

  eyeOf(v) {                     // the player's eye for a scene version: its view spot at its stance's eye height
    const view = this.things[v.view], h = EYES[v.stance || "stand"] || EYE;
    return view ? s2t(view.pos[0], view.pos[1], view.pos[2] + h) : new THREE.Vector3(0, h, 0);
  }
  reachTarget(to, v) {           // a reach target in world space: player_collar, player_face, or a placed thing
    if (to === "player_face" || to === "player_collar") return this.eyeOf(v).add(new THREE.Vector3(0, to === "player_collar" ? -0.25 : -0.05, 0));
    const t = this.things[to];
    return t ? s2t(t.pos[0], t.pos[1], t.pos[2] + (t.size ? t.size[2] / 2 : 0)) : null;
  }
  targetPos(id) {
    if (this.cast[id] && this.cast[id].group.visible) return this.cast[id].headWorld();
    const t = this.things[id];
    if (t) return s2t(t.pos[0], t.pos[1], t.pos[2] + (t.size ? t.size[2] / 2 : 0) + (t.use === "light" ? 0 : 0));
    return null;
  }

  apply(tl, state, T) {          // pose the figures, aim the camera, set the lights
    const v = tl.v;
    for (const [cid, f] of Object.entries(this.cast)) {
      const spot = this.things[(v.stage || {})[cid]];
      f.group.visible = !!spot;
      if (!spot) continue;
      f.group.position.copy(s2t(spot.pos[0], spot.pos[1], spot.pos[2]));
      f.group.rotation.y = yawToThree(spot.yaw);
      f.group.updateMatrixWorld(true);
      f.reach = {};
      const rc = (state.reach || {})[cid];
      if (rc && f.reachTo) {                      // both hands: either side of the target, along the actor's left
        const hands = rc.hand === "both" ? ["left", "right"] : [rc.hand];
        for (const h of hands) {
          const p = f.group.worldToLocal(rc.target.clone());
          if (rc.hand === "both") p.x += h === "left" ? 0.18 : -0.18;
          if (rc.offset) p.add(new THREE.Vector3(...rc.offset));
          f.reach[h] = { target: p, w: rc.w };
        }
      }
      if (state.poses[cid]) f.update(state.poses[cid]);
    }
    const eye = this.eyeOf(v), view = this.things[v.view];
    const fwd = view ? new THREE.Vector3(Math.cos(view.yaw * Math.PI / 180), 0, -Math.sin(view.yaw * Math.PI / 180)) : new THREE.Vector3(0, 0, -1);
    let target = this.targetPos(state.cam.look) || eye.clone().add(fwd);
    if (state.cam.lean) { const d = target.clone().sub(eye).setY(0); if (d.lengthSq() > 1e-6) eye.addScaledVector(d.normalize(), state.cam.lean); }
    if (state.glance && this.targetPos(state.glance.target)) target = target.clone().lerp(this.targetPos(state.glance.target), state.glance.w);
    const c = this.camera;
    if (this.free) { this.applyFree(); }
    else {
      c.position.copy(eye);
      c.lookAt(target);
      if (state.cam.pov) c.rotateX(state.cam.pov * Math.PI / 180);
      if (state.cam.mode !== "hard" && state.cam.userLook) {      // the player's own look, inside the cone
        const [cy, cp] = state.cam.mode === "free" ? [180, 80] : state.cam.cone;
        c.rotateY(-Math.max(-cy, Math.min(cy, state.cam.userLook.yaw)) * Math.PI / 180);
        c.rotateX(Math.max(-cp, Math.min(cp, state.cam.userLook.pitch)) * Math.PI / 180);
      }
      c.rotateZ(state.cam.roll * Math.PI / 180);
      if (state.cam.shake) { const s = state.cam.shake * 0.012; c.rotateX((Math.sin(T * 41) + Math.sin(T * 23)) * s); c.rotateY((Math.sin(T * 37) + Math.sin(T * 19)) * s); }
      c.fov = state.cam.fov;                                         // a cutaway is a head turn, not a lens
      c.updateProjectionMatrix();
    }
    for (const l of this.lights) {
      let k = 1;
      if (l.userData.flicker) k *= 1 - l.userData.flicker * 0.5 * Math.max(0, Math.sin(T * 13.7) * Math.sin(T * 7.3));
      if (state.flicker) k *= 0.05;
      l.intensity = l.userData.base * k;
    }
  }
  render() { this.renderer.render(this.scene, this.camera); }
  async dress(block, ref, [w, h, d], real) {       // a library mesh in its block: real size, or scaled evenly to fit
    const src = await libMesh(ref);                // (like the importer's fit_art), centred, resting on the block's base
    if (!src || block.parent !== this.world) return;
    const g = src.clone(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = real ? 1 : Math.min(...[[w, size.x], [h, size.y], [d, size.z]].filter(([, s]) => s > 0.001).map(([a, s]) => a / s));
    const holder = new THREE.Group(); holder.add(g); g.position.set(-c.x, -box.min.y, -c.z);
    holder.scale.setScalar(k); holder.position.y = -h / 2;
    g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material = o.material.clone(); } });
    block.add(holder); block.material = block.material.clone(); block.material.visible = false;
    block.userData.dressed = true;
    this.render();
  }
  async assetsReady() { await Promise.all(this.pending || []); this.render(); }

  frame(sc, T, files) { const tl = this.timeline(sc); const st = this.stateAt(tl, T, files); this.apply(tl, st, T); this.render(); return st; }

  // ---- the free camera (inspect the set from outside) --------------------------------------------------------
  setFree(on) {
    for (const m of this.solid) if (m.userData.kind === "ceiling") m.visible = !on;
    this.scene.fog.far = on ? 400 : 16; this.scene.fog.near = on ? 300 : 4;
    if (!on) { this.free = null; return; }
    const c = this.camera.position.clone();
    this.free = { target: c.clone().add(new THREE.Vector3(0, -0.4, -2)), dist: 4.5, yaw: 0.6, pitch: 0.5 };
  }
  applyFree() {
    const f = this.free, c = this.camera;
    c.position.set(f.target.x + f.dist * Math.cos(f.pitch) * Math.sin(f.yaw), f.target.y + f.dist * Math.sin(f.pitch), f.target.z + f.dist * Math.cos(f.pitch) * Math.cos(f.yaw));
    c.lookAt(f.target); c.fov = 60; c.updateProjectionMatrix();
  }

  // ---- framing from the player's eye: how close the subject comes (the shot it really is), the angle, the eyes ----
  framing(sc, files) {
    const tl = this.timeline(sc), out = [];
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const c = seg.clip, shot = c.shot === "closeup" ? "cu" : c.shot, f = this.cast[(tl.v.camera || {}).look] || this.cast[c.who];
      if (!f || !(tl.v.stage || {})[c.who]) continue;
      let best = null;                                  // the clip's closest moment decides the framing it reaches
      for (const k of [0.15, 0.5, 0.85, 1]) {
        const T = seg.start + seg.dur * k, st = this.stateAt(tl, T, files); this.apply(tl, st, T);
        f.group.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
        const head = f.jointWorld("head"); if (!head) continue;
        const d = this.camera.position.distanceTo(head);
        if (!best || d < best.dist) {
          const to = head.clone().sub(this.camera.position);
          const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z)) * 180 / Math.PI;
          const eyesV = head.clone().project(this.camera).y;         // -1 bottom .. 1 top of the frame
          best = { clip: c.id, who: c.who, shot, dist: d, pitch, eyesV, real: shotFor(d), at: k };
        }
      }
      if (best) out.push(Object.assign(best, shot && SHOTS[shot] ? { near: SHOTS[shot].near, far: SHOTS[shot].far } : {}));
    }
    return out;
  }

  // ---- reaches: can the hand get there from where the actor stands? ---------------------------------------------
  reachCheck(sc, files) {
    const tl = this.timeline(sc), out = [];
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const r = (seg.clip.body || {}).reach, f = this.cast[seg.clip.who];
      if (!r || !r.to || !f || !f.reachTo) continue;
      const at = +(r.at ?? 0.5), until = +(r.until ?? 1), side = (r.hand || "right") === "left" ? "l" : "r";
      let miss = 0, when = at;
      for (const k of [0, 0.33, 0.66, 1]) {               // the whole hold, not just the moment it lands
        const u = Math.min(0.999, at + (until - at) * k), T = seg.start + seg.dur * u, st = this.stateAt(tl, T, files);
        this.apply(tl, st, T);
        const tg = this.reachTarget(r.to, tl.v), h = f.modelJointWorld(`hand_${side}`);
        if (tg && h && h.distanceTo(tg) > miss) { miss = h.distanceTo(tg); when = u; }
      }
      out.push({ clip: seg.clip.id, who: seg.clip.who, to: r.to, miss, when });
    }
    return out;
  }

  // ---- what the player can see ---------------------------------------------------------------------------------
  visibility(sc, files) {
    const tl = this.timeline(sc), out = [];
    const ray = new THREE.Raycaster();
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const who = seg.clip.who, f = this.cast[who];
      const seen = {};
      if (!f || !(tl.v.stage || {})[who]) { out.push({ clip: seg.clip.id, who, offstage: true }); continue; }
      for (const u of [0.1, 0.35, 0.6, 0.9]) {
        const T = seg.start + seg.dur * u, st = this.stateAt(tl, T, files);
        this.apply(tl, st, T);
        f.group.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);
        for (const j of this.lib.joints) {
          const w = f.jointWorld(j.name); if (!w) continue;
          const ndc = w.clone().project(this.camera);
          let vis = ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
          if (vis) {
            const from = this.camera.position, dir = w.clone().sub(from), dist = dir.length();
            ray.set(from, dir.normalize()); ray.far = dist - 0.03;
            const hit = ray.intersectObjects(this.solid, false)[0];
            if (hit) { vis = false; seen[j.name] = seen[j.name] || { by: hit.object.userData.id }; }
          }
          if (vis) seen[j.name] = { vis: true };
        }
      }
      const visible = this.lib.joints.map(j => j.name).filter(n => seen[n] && seen[n].vis);
      const hidden = this.lib.joints.map(j => j.name).filter(n => !(seen[n] && seen[n].vis));
      const why = {};
      for (const n of hidden) why[n] = (seen[n] && seen[n].by) || "out of frame";
      out.push({ clip: seg.clip.id, who, visible, hidden, why });
    }
    return out;
  }

  // ---- storyboard frames ---------------------------------------------------------------------------------------
  thumb(sc, T, files, w = 320, h = 180) {
    if (!this.thumbR) { this.thumbR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    this.thumbR.setSize(w, h, false);
    const keep = this.free; this.free = null;
    const aspect = this.camera.aspect; this.camera.aspect = w / h;
    const st = this.frame(sc, T, files);
    this.thumbR.render(this.scene, this.camera);
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.free = keep;
    let url = this.thumbR.domElement.toDataURL("image/jpeg", 0.8);
    return { url, st };
  }

  // ---- export the blocking for Unreal (glTF: the previs skeleton + one animation per clip) ---------------------
  async exportGLTF(sc, game, sid, GLTFExporter) {
    const lib = this.lib, v = version(sc), fps = 30, clips = [];
    this.timeline(sc);                                // resolves moves and where each clip starts
    const root = new THREE.Group(); root.name = "previs";
    const bones = {}, list = [];
    for (const j of lib.joints) {
      const b = new THREE.Bone(); b.name = j.name; b.position.copy(j.off);
      bones[j.name] = b; list.push(b);
      if (j.parent) bones[j.parent].add(b); else root.add(b);
    }
    // a simple skinned body (a box per bone), so the file imports as a skeletal mesh
    const geo = new THREE.BufferGeometry(), P = [], I = [], W = [], IDX = [];
    let base = 0;
    lib.joints.forEach((j, bi) => {
      if (!j.parent) return;
      const pi = lib.index[j.parent], a = this.restWorld(j.parent), b = this.restWorld(j.name);
      const box = new THREE.BoxGeometry(0.06, 0.06, 0.06); box.translate(...a.clone().lerp(b, 0.5).toArray());
      const pa = box.attributes.position.array; for (let k = 0; k < pa.length; k++) P.push(pa[k]);
      for (let k = 0; k < pa.length / 3; k++) { I.push(pi, 0, 0, 0); W.push(1, 0, 0, 0); }
      for (const ix of box.index.array) IDX.push(ix + base);
      base += pa.length / 3;
    });
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(I, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(W, 4));
    geo.setIndex(IDX); geo.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    mesh.name = "previs_body";
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    for (const c of v.clips || []) {
      if (c.body && c.body.file) continue;                              // generated motions already live in Unreal
      const dur = clipSecs(c), n = Math.max(2, Math.round(dur * fps) + 1), times = [];
      const qv = {}, pv = [];
      for (const j of lib.joints) qv[j.name] = [];
      for (let f = 0; f < n; f++) {
        const t = f / fps; times.push(t);
        const keys = (c.body && c.body.block && c.body.block.length) ? c.body.block : [{ at: 0, pose: "idle" }];
        const p = M.evalBlock(lib, keys, M.remap((c.body || {}).mods, Math.min(1, t / dur), dur) * dur, dur, c._startMove);
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw).multiply(p.rootRot);
        for (const j of lib.joints) {
          const q = j.parent ? p.q[j.name] : yawQ.clone().multiply(p.q[j.name]);
          qv[j.name].push(q.x, q.y, q.z, q.w);
        }
        const r = lib.joints[0].off.clone().add(p.root.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)).add(p.move);
        pv.push(r.x, r.y, r.z);
      }
      const tracks = lib.joints.map(j => new THREE.QuaternionKeyframeTrack(`${j.name}.quaternion`, times, qv[j.name]));
      tracks.push(new THREE.VectorKeyframeTrack(`${lib.joints[0].name}.position`, times, pv));
      clips.push(new THREE.AnimationClip(`${game}_${sid}_${sc.pick || "main"}_${c.id}`, dur, tracks));
    }
    const exporter = new GLTFExporter();
    const glb = await exporter.parseAsync(root, { binary: true, animations: clips });
    return { blob: new Blob([glb], { type: "model/gltf-binary" }), clips: clips.map(c => c.name) };
  }
  restWorld(name) {
    let p = new THREE.Vector3(), j = this.lib.joints[this.lib.index[name]];
    while (j) { p.add(j.off); j = j.parent ? this.lib.joints[this.lib.index[j.parent]] : null; }
    return p;
  }
}

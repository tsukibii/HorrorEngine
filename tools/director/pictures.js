// Pictures, so the desk shows things and doesn't only name them: a cast member's face (their desk body, head and
// shoulders, in their skin tone), a pose (the body holding it), a motion (its body at four moments, ghosted), and what
// the player sees on a line (the stage from the player's eye, Stage.thumb, on a stage of its own off screen, so the one
// on screen never moves). Each is made the first time it's asked for, a few a frame, and kept until what it shows
// changes; an <img> asked for meanwhile shows the last picture, dimmed, and is filled when the new one is made.
//   new Pictures(D): D: stage (an off-screen Stage), story(), plan(), files(), rev() (changes on every edit),
//                    timeOf(sid) (the scene's time of day), color(who), load(file) (a motion file into files())
//   pics.img(kind, id, {cls, title}) -> <img>   kinds: cast (id), pose (name), motion (file), line ([sid, variant, clip])
import * as THREE from "three";
import * as M from "./motion.js";
import { Figure, version } from "./stage.js";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const SIZE = { cast: [64, 64], pose: [60, 80], motion: [120, 80], line: [160, 90] };
const Y = new THREE.Vector3(0, 1, 0);
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// the camera along dir from the box's middle, as close as it can be with the whole box in view
function fit(cam, box, dir, pad = 1.1) {
  const c = box.getCenter(new THREE.Vector3()), fwd = dir.clone().normalize().negate();
  const right = new THREE.Vector3().crossVectors(fwd, Y).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
  let hw = 0, hh = 0, hd = 0;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
    hw = Math.max(hw, Math.abs(p.dot(right))); hh = Math.max(hh, Math.abs(p.dot(up))); hd = Math.max(hd, Math.abs(p.dot(fwd)));
  }
  const t = Math.tan(cam.fov * Math.PI / 360), d = Math.max(hh / t, hw / (t * cam.aspect)) * pad + hd;
  cam.position.copy(c).addScaledVector(fwd, -d); cam.lookAt(c); cam.near = Math.max(0.01, d - hd * 3); cam.far = d + hd * 3 + 1; cam.updateProjectionMatrix();
}
const boxOf = (pos, grow = 0.12) => { const b = new THREE.Box3(); for (const k in pos) if (!k.startsWith("soma:")) b.expandByPoint(pos[k]); return b.expandByScalar(grow); };

export class Pictures {
  constructor(D) {
    this.D = D; this.cache = new Map(); this.queue = new Map(); this.busy = false; this.memo = new WeakMap(); this.memoRev = null;
    this.scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xfff0dd, 1.7); key.position.set(1.6, 2.6, 3);
    const rim = new THREE.DirectionalLight(0x9fb6ff, 0.9); rim.position.set(-2.2, 1.6, -2.4);
    this.scene.add(new THREE.HemisphereLight(0xcfd3dd, 0x2a2420, 0.85), key, rim);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
  }
  get lib() { return this.D.stage.lib; }
  // the <img> for a picture: the last one made (fresh, or dimmed while a new one is made), or blank until the first
  img(kind, id, o = {}) {
    const key = kind + ":" + (Array.isArray(id) ? id.map(x => x ?? "").join("|") : id), r = this.want(kind, id, key);
    const im = document.createElement("img");
    im.className = `pic pic-${kind}${o.cls ? " " + o.cls : ""}${r.fresh ? "" : " stale"}${r.none ? " none" : ""}`;
    im.dataset.pic = key; im.alt = ""; im.draggable = false; im.src = r.url || BLANK; if (o.title) im.title = o.title;
    return im;
  }
  url(kind, id) { const key = kind + ":" + (Array.isArray(id) ? id.map(x => x ?? "").join("|") : id), r = this.want(kind, id, key); return r.url; }
  want(kind, id, key) {
    let sig; try { sig = this.sig(kind, id); } catch (e) { return { url: null, none: true }; }
    if (sig === null) return { url: null, none: true };
    const have = this.cache.get(key);
    if (have && have.sig === sig) return { url: have.url, fresh: true, none: !have.url };
    const q = this.queue.get(key); if (!q || q.sig !== sig) this.queue.set(key, { kind, id, sig });
    this.pump();
    return { url: have ? have.url : null, fresh: false };
  }
  // what a picture shows, as a short string: the same string, the same picture
  sig(kind, id) {
    const S = this.D.story(), st = this.D.stage, bodies = Object.keys(st.bodies).join() + "|" + st.defaultBody + "|" + ((S.game || {}).previs_body || "");
    if (kind === "cast") { const c = (S.cast || {})[id]; return c ? hash(JSON.stringify([c, bodies])) : null; }
    if (kind === "pose") return this.lib.poses[id] ? id + "|" + hash(bodies) : null;
    if (kind === "motion") { const f = this.D.files()[id]; return id + "|" + (f ? f.pos.length : "-"); }
    if (kind === "line") {
      const [sid, k, cid] = id, sc = (S.scenes || {})[sid]; if (!sc) return null;
      return `${this.sceneSig(sc, sid)}|${k || ""}|${cid}|${Object.keys(this.D.files()).length}|${this.D.plan() ? this.planId(this.D.plan()) : "-"}`;
    }
    return null;
  }
  sceneSig(sc, sid) {                              // the scene with all it depends on (the level, the cast, the time), once per edit
    const rev = this.D.rev(); if (rev !== this.memoRev) { this.memo = new WeakMap(); this.memoRev = rev; }
    let s = this.memo.get(sc);
    if (!s) { const S = this.D.story(); s = hash(JSON.stringify([sc, (S.levels || {})[sc.level], S.cast, this.D.timeOf(sid), Object.keys(this.D.stage.bodies)])); this.memo.set(sc, s); }
    return s;
  }
  planId(plan) { if (!this._plans) this._plans = new WeakMap(); if (!this._plans.has(plan)) this._plans.set(plan, (this._planN = (this._planN || 0) + 1)); return this._plans.get(plan); }
  // a few pictures a frame, the page kept smooth between them
  async pump() {
    if (this.busy) return; this.busy = true;
    try {
      while (this.queue.size) {
        await new Promise(r => (typeof requestAnimationFrame === "function" && !document.hidden ? requestAnimationFrame(r) : setTimeout(r, 30)));
        const t0 = performance.now();
        while (this.queue.size && performance.now() - t0 < 12) {
          const [key, job] = this.next(); this.queue.delete(key);
          let url = null;
          try { url = await this.make(job.kind, job.id); } catch (e) { console.warn("picture", key, e); }
          if (url === undefined) continue;          // not ready (a motion still loading): asked for again when it is
          this.cache.set(key, { sig: job.sig, url });
          for (const im of document.querySelectorAll(`img[data-pic="${CSS.escape(key)}"]`)) { im.src = url || BLANK; im.classList.remove("stale"); im.classList.toggle("none", !url); }
        }
      }
    } finally { this.busy = false; }
  }
  next() {                                         // a frame on the level the stage has built first: fewer rebuilds
    const st = this.D.stage, S = this.D.story();
    for (const e of this.queue) if (e[1].kind === "line") { const sc = (S.scenes || {})[e[1].id[0]]; if (sc && st.level === version(sc).level) return e; }
    return this.queue.entries().next().value;
  }
  make(kind, id) { return kind === "cast" ? this.castPic(id) : kind === "pose" ? this.posePic(id) : kind === "motion" ? this.motionPic(id) : kind === "line" ? this.linePic(id) : null; }
  shoot(objs, [w, h], bg, aim) {
    const R = this.D.stage.renderer;
    R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = 30;
    this.scene.background = new THREE.Color(bg);
    for (const o of objs) this.scene.add(o);
    for (const o of objs) o.updateMatrixWorld(true);
    aim(this.cam);
    R.render(this.scene, this.cam);
    const url = R.domElement.toDataURL("image/jpeg", 0.86);
    for (const o of objs) this.scene.remove(o);
    return url;
  }
  // a cast member's face: their desk body (the game's, or the default), standing, head and shoulders, three quarters
  castPic(id) {
    const S = this.D.story(), c = (S.cast || {})[id]; if (!c) return null;
    const lib = this.lib, h = +c.height || 1.7, f = this.D.stage.makeFigure(c, c.skin ? new THREE.Color(c.skin).getHex() : undefined);
    f.update(M.fk(lib, M.clonePose(lib.poses.idle || Object.values(lib.poses)[0]), h).pos);
    const bg = new THREE.Color(this.D.color(id)).lerp(new THREE.Color(0x141417), 0.72);
    return this.shoot([f.group], SIZE.cast, bg, cam => {
      f.group.updateMatrixWorld(true);
      const head = f.headWorld(), at = head.clone().add(new THREE.Vector3(0, -0.01, 0)), dir = new THREE.Vector3(0.34, 0.05, 1).normalize();
      cam.position.copy(at).addScaledVector(dir, 0.92); cam.lookAt(at); cam.near = 0.05; cam.far = 5; cam.updateProjectionMatrix();
    });
  }
  // a pose from the library on the game's desk body (one kept for all of them)
  posePic(name) {
    const lib = this.lib, p = lib.poses[name]; if (!p) return null;
    const st = this.D.stage, tpl = st.bodyFor({});
    if (!this.poseFig || this.poseTpl !== tpl) { this.poseFig = st.makeFigure({ height: 1.7 }); this.poseTpl = tpl; }
    const pos = M.fk(lib, M.clonePose(p), 1.7).pos; this.poseFig.update(pos);
    return this.shoot([this.poseFig.group], SIZE.pose, 0x1c1c21, cam => fit(cam, boxOf(pos), new THREE.Vector3(0.55, 0.22, 1)));
  }
  // a made motion: its body at the start, a third, two thirds and the end, the earlier ones fainter
  motionPic(file) {
    const f = this.D.files()[file];
    if (!f) { if (this.D.load) Promise.resolve(this.D.load(file)).then(() => { if (this.D.files()[file]) this.want("motion", file, "motion:" + file); }).catch(() => {}); return this.D.load ? undefined : null; }
    const lib = this.lib, k = f.height ? 1.7 / f.height : 1;
    if (!this.ghosts) this.ghosts = [0.2, 0.38, 0.62, 1].map(o => { const g = new Figure(lib, 1.7, 0xc8c2b6); if (o < 1) { g.mat.transparent = true; g.mat.opacity = o; g.mat.depthWrite = false; } return g; });
    const box = new THREE.Box3();
    this.ghosts.forEach((g, i) => { const pos = M.sampleBaked(f, i / 3).pos; for (const n in pos) pos[n].multiplyScalar(k); g.update(pos); box.union(boxOf(pos)); });
    return this.shoot(this.ghosts.map(g => g.group), SIZE.motion, 0x1c1c21, cam => fit(cam, box, new THREE.Vector3(1, 0.35, 0.8), 1.05));
  }
  // what the player sees on a line: its scene's level and time on the off-screen stage, 45 % into the clip
  async linePic([sid, k, cid]) {
    const S = this.D.story(), sc = (S.scenes || {})[sid], plan = this.D.plan(); if (!sc || !plan) return null;
    const pv = k && sc.variants && sc.variants[k] ? Object.assign({}, sc, { pick: k }) : sc, v = version(pv);
    const st = this.D.stage, lvl = v.level || Object.keys(S.levels || {})[0];
    const wsig = hash(JSON.stringify([S.cast, Object.keys(st.bodies), st.defaultBody, (S.game || {}).previs_body, (S.levels || {})[lvl]]));
    if (st.plan !== plan || st.level !== lvl || st.story !== S || this.worldSig !== wsig) {
      st.setWorld(plan, S, lvl); this.worldSig = wsig;
      await Promise.race([Promise.all(st.pending || []), new Promise(r => setTimeout(r, 4000))]);   // the library's meshes in first
    }
    st.setTime(this.D.timeOf(sid));
    const tl = st.timeline(pv), seg = tl.segs.find(s => s.type === "clip" && s.clip.id === cid && !s.answer);
    if (!seg) return null;
    return st.thumb(pv, seg.start + seg.dur * 0.45, this.D.files(), ...SIZE.line).url;
  }
}

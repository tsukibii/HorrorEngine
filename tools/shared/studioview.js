// A studio view for any three.js page: a white seamless background, image-based light from an HDR (Content/Studio/Env/), one soft
// key light with shadows, a floor that only shows the shadow, and filmic tone mapping. It is a quick look at how a model will read
// in a lit render, not a path tracer. Our own code.
//
//   import { StudioView } from "/shared/studioview.js";           (the page's import map has "three"; the server serves /shared, /env, /vendor)
//   const studio = new StudioView({ renderer, scene, root: rigOrScene, hide: [page's own floor] });
//   studio.mountUI(document.querySelector("#studio"));           // a checkbox and sliders, remembered in localStorage
//   studio.set(true);                                             // or studio.toggle()
//   in the render loop, before renderer.render():  studio.tick();   // follows meshes added later (hair, clothes)
//
// While on it hides the page's other lights and its own floor (opts.hide), sets the background, environment, tone mapping and shadow
// maps, and puts every one of them back when it's off. Settings: exposure, light (the HDR's strength), key light and its angle,
// shadow strength, background (white, grey or the HDR itself).
import * as THREE from "three";
import { RGBELoader } from "/vendor/RGBELoader.js";

const DEFAULTS = { exposure: 1.0, env: 1.0, key: 1.6, keyAngle: -35, shadow: 0.3, background: "white" };
const KEY = "studioview:settings";

export class StudioView {
  // opts: renderer, scene, root (what to light and shadow; default the scene), hide (objects hidden while on), envUrl, floorY (default the root's lowest point)
  constructor(opts) {
    Object.assign(this, { renderer: opts.renderer, scene: opts.scene, root: opts.root || opts.scene, hide: opts.hide || [], envUrl: opts.envUrl || "/env/studio_small_09_1k.hdr" });
    this.floorY = opts.floorY;
    this.on = false; this.s = { ...DEFAULTS };
    try { Object.assign(this.s, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { }
    this.saved = null; this.hidden = []; this.frame = 0; this.envTex = null; this.loading = null;
    this.key = new THREE.DirectionalLight(0xffffff, this.s.key);
    this.key.shadow.mapSize.set(2048, 2048); this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.012; this.key.shadow.radius = 3;
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: this.s.shadow, depthWrite: false }));
    this.floor.receiveShadow = true; this.floor.userData.noShadow = true; this.floor.renderOrder = -1;
    this.listeners = [];
  }

  async load() {                                          // the HDR into a prefiltered environment, once
    if (this.envTex) return this.envTex;
    this.loading = this.loading || new RGBELoader().loadAsync(this.envUrl).then(tex => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer); this.envTex = pm.fromEquirectangular(tex).texture; this.hdr = tex; pm.dispose();
      return this.envTex;
    });
    return this.loading;
  }

  async set(on) {
    if (on === this.on) return;
    if (!on) return this.off();
    await this.load();
    const r = this.renderer, sc = this.scene;
    this.saved = { bg: sc.background, env: sc.environment, tm: r.toneMapping, exp: r.toneMappingExposure, sm: r.shadowMap.enabled, smt: r.shadowMap.type };
    this.hidden = [];
    sc.traverse(o => { if (o.isLight && o !== this.key && o.visible) { o.visible = false; this.hidden.push(o); } });
    for (const o of this.hide) if (o.visible) { o.visible = false; this.hidden.push(o); }
    r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    sc.add(this.key, this.key.target, this.floor);
    this.on = true; this.apply(true);
    this.listeners.forEach(f => f(true));
  }
  off() {
    if (!this.on) return;
    const r = this.renderer, sc = this.scene, s = this.saved;
    sc.background = s.bg; sc.environment = s.env; r.toneMapping = s.tm; r.toneMappingExposure = s.exp; r.shadowMap.enabled = s.sm; r.shadowMap.type = s.smt;
    sc.remove(this.key, this.key.target, this.floor);
    for (const o of this.hidden) o.visible = true;
    this.hidden = []; this.on = false;
    this.eachMaterial(m => { if (m.userData.__env0 !== undefined) { m.envMapIntensity = m.userData.__env0; delete m.userData.__env0; delete m.userData.__envNow; } m.needsUpdate = true; });
    this.root.traverse(o => { if (o.isMesh && o.userData.__shadowSet) { o.castShadow = o.userData.__cast0; o.receiveShadow = o.userData.__recv0; delete o.userData.__shadowSet; } });
    this.listeners.forEach(f => f(false));
  }
  toggle() { return this.set(!this.on); }
  onChange(f) { this.listeners.push(f); }

  eachMaterial(fn) {
    const seen = new Set();
    this.scene.traverse(o => { for (const m of [].concat(o.material || [])) if (m && !seen.has(m)) { seen.add(m); fn(m, o); } });
  }

  // everything that follows the settings; `full` also rebuilds what only changes when the model does
  apply(full = false) {
    if (!this.on) return;
    const r = this.renderer, sc = this.scene, s = this.s;
    r.toneMappingExposure = s.exposure;
    sc.environment = this.envTex;
    sc.background = s.background === "hdr" ? this.hdr : new THREE.Color(s.background === "grey" ? 0xc9cbcf : 0xffffff);
    if (s.background === "hdr") { sc.backgroundBlurriness = 0.35; sc.backgroundIntensity = 0.8; }
    this.key.intensity = s.key; this.floor.material.opacity = s.shadow;
    this.fit();
    this.eachMaterial((m, o) => {                          // env strength: scale what the page set; remember it to put back
      if (m.envMapIntensity === undefined) return;
      if (m.userData.__env0 === undefined || m.envMapIntensity !== m.userData.__envNow) m.userData.__env0 = m.envMapIntensity;   // the page changed it: that's the new base
      m.userData.__envNow = m.userData.__env0 * s.env; m.envMapIntensity = m.userData.__envNow;
      if (full) m.needsUpdate = true;
    });
    this.shadows();
  }
  shadows() {                                              // every mesh of the model casts and receives (the floor only receives)
    this.root.traverse(o => {
      if (!o.isMesh || o.userData.noShadow || o === this.floor) return;
      if (!o.userData.__shadowSet) { o.userData.__shadowSet = true; o.userData.__cast0 = o.castShadow; o.userData.__recv0 = o.receiveShadow; }
      o.castShadow = true; o.receiveShadow = true;
    });
  }
  // the key light and its shadow camera fitted to the model, the floor under its feet
  fit() {
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    this.root.traverse(o => { if (o.isMesh && o.visible && !o.userData.noShadow && o !== this.floor && o.geometry) { const g = o.geometry; if (!g.boundingBox || (g.attributes.position && g.attributes.position.count < 60000)) g.computeBoundingBox();      // morphs and posing move the points: not a stale box
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); } });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), R = Math.max(size.x, size.y, size.z) * 0.75 + 0.1;
    const a = this.s.keyAngle * Math.PI / 180;
    this.key.position.set(c.x + Math.sin(a) * R * 3, c.y + R * 2.6, c.z + Math.cos(a) * R * 3); this.key.target.position.copy(c); this.key.target.updateMatrixWorld();
    const sh = this.key.shadow.camera; sh.left = -R; sh.right = R; sh.top = R; sh.bottom = -R; sh.near = 0.1; sh.far = R * 9; sh.updateProjectionMatrix();
    this.floor.position.set(c.x, this.floorY ?? box.min.y - 0.001, c.z);
    this.floor.scale.setScalar(Math.max(0.5, R / 1.6));
  }
  // call every frame (cheap: it does its work every 20th); picks up meshes added since (hair, clothes) and a moved model
  tick() { if (this.on && (++this.frame % 20 === 0)) { this.fit(); this.shadows(); } }

  set_(k, v) { this.s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { } this.apply(); }

  // a checkbox and the sliders, into `box` (they use the page's own .row / small styles if it has them)
  mountUI(box) {
    const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
    const on = el("input", { type: "checkbox", checked: this.on });
    on.onchange = () => this.set(on.checked);
    this.onChange(v => { on.checked = v; });
    box.append(el("label", { className: "tog" }, on, el("span", {}, "Studio view", el("small", { textContent: "A white studio, soft light from a studio HDR and one key light with shadows: how the model reads in a lit render. Not a path tracer." }))));
    const row = (label, key, lo, hi, step, help) => {
      const inp = el("input", { type: "range", min: lo, max: hi, step, value: this.s[key] }), out = el("output", { textContent: (+this.s[key]).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0) });
      inp.oninput = () => { this.set_(key, +inp.value); out.textContent = (+inp.value).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0); };
      box.append(el("div", { className: "row", title: help || "" }, el("span", { textContent: label }), inp, out));
    };
    row("Exposure", "exposure", 0.3, 2.5, 0.05, "The tone mapping's brightness.");
    row("Studio light", "env", 0, 2.5, 0.05, "How strong the HDR's light and reflections are on the model.");
    row("Key light", "key", 0, 5, 0.05, "The one light that casts the shadow.");
    row("Key angle", "keyAngle", -180, 180, 1, "Where the key light sits round the model.");
    row("Shadow", "shadow", 0, 0.8, 0.01, "How dark the shadow on the floor is.");
    const bg = el("select"); for (const [v, t] of [["white", "white"], ["grey", "light grey"], ["hdr", "the HDR, blurred"]]) bg.append(el("option", { value: v, textContent: t, selected: this.s.background === v }));
    bg.onchange = () => this.set_("background", bg.value);
    box.append(el("div", { className: "row" }, el("span", { textContent: "Background" }), bg, el("output")));
    return this;
  }
}

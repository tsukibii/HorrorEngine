// The made prop in 3D: its .glb as Godot will read it (base colour, ORM, normal map), under a soft studio light with
// an environment for the metals to reflect, its sockets (where a flame, steam or a light goes) as small blue markers
// pointing their way. Drag to turn it, the wheel to come closer, a double-click to frame it again. The picture editor
// gives it its canvases to wear in place of the made colour maps (`setMaps`, live as they're edited) and is told which
// part a click lands on (`onPick`: the material and the UV there).
import * as THREE from "three";
import { GLTFLoader } from "/vendor/GLTFLoader.js";

export function makeViewer(box, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch (e) {
    box.textContent = "No WebGL in this browser: " + e.message;
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  box.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b30);
  // a studio for reflections: a dome dark below and grey above, two bright softboxes
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 p; void main(){ float h = normalize(p).y; gl_FragColor = vec4(mix(vec3(0.05), vec3(0.55, 0.55, 0.58), smoothstep(-0.25, 0.9, h)), 1.0); }",
  })));
  for (const [x, y, z, s, k] of [[4, 6, 3, 4, 6], [-6, 3, -1, 3, 3], [0, -2, -6, 6, 0.8]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    env.add(p);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 4, 3);
  scene.add(key, new THREE.HemisphereLight(0xdde4ff, 0x302820, 0.5));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.002, 200);
  const orbit = { yaw: -0.6, pitch: 0.38, dist: 1, target: new THREE.Vector3(), home: null };
  let root = null, spin = false, down = null;
  const place = () => {
    const c = Math.cos(orbit.pitch);
    cam.position.set(orbit.target.x + orbit.dist * Math.sin(orbit.yaw) * c, orbit.target.y + orbit.dist * Math.sin(orbit.pitch),
      orbit.target.z + orbit.dist * Math.cos(orbit.yaw) * c);
    cam.lookAt(orbit.target);
  };
  const el = renderer.domElement;
  let moved = 0;
  el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => {
    if (!down) return;
    moved += Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
    orbit.yaw -= (e.clientX - down.x) * 0.008;
    orbit.pitch = Math.max(-1.2, Math.min(1.45, orbit.pitch + (e.clientY - down.y) * 0.006));
    down = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener("pointerup", e => {
    down = null;
    if (moved < 4 && opts.onPick) { const hit = pick(e.clientX, e.clientY); if (hit) opts.onPick(hit); }
  });
  el.addEventListener("wheel", e => { e.preventDefault(); orbit.dist *= Math.exp(e.deltaY * 0.001); }, { passive: false });
  el.addEventListener("dblclick", () => { if (orbit.home) Object.assign(orbit, { ...orbit.home, target: orbit.home.target.clone() }); });
  const fit = () => {
    const w = box.clientWidth || 400, h = box.clientHeight || 300;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(box);
  fit();
  let alive = true;
  const loop = () => {
    if (!alive) return;
    if (spin && !down) orbit.yaw += 0.006;
    place();
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // what's under a point of the view: the material's name and the UV there (glTF's: v down from the texture's top)
  const ray = new THREE.Raycaster();
  function pick(cx, cy) {
    if (!root) return null;
    const b = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1), cam);
    const hit = ray.intersectObject(root, true).find(h => h.object.isMesh && h.uv && !/_liquid$/.test(h.object.name));
    if (!hit) return null;
    const m = [].concat(hit.object.material)[hit.face && hit.face.materialIndex || 0] || [].concat(hit.object.material)[0];
    return { material: m.name, uv: [hit.uv.x, hit.uv.y], point: hit.point.toArray() };
  }

  // the picture editor's canvases worn as the colour maps of the materials they name ({material name: canvas}); a
  // name given null (or left out) wears its made map again
  const live = new Map();
  function setMaps(maps) {
    let n = 0;
    if (!root) return n;
    root.traverse(o => {
      for (const m of [].concat(o.material || [])) {
        if (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) continue;
        if (!("_madeMap" in m.userData)) m.userData._madeMap = m.map || null;
        const cv = maps[m.name];
        if (cv) {
          let t = live.get(cv);
          if (!t) {
            t = new THREE.CanvasTexture(cv);
            t.flipY = false;
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            live.set(cv, t);
          }
          if (m.map !== t) { m.map = t; m.needsUpdate = true; }
          n++;
        } else if (m.map !== m.userData._madeMap) {
          m.map = m.userData._madeMap;
          m.needsUpdate = true;
        }
      }
    });
    return n;
  }
  function touchMaps() { for (const t of live.values()) t.needsUpdate = true; }
  function liveMaps() {
    const out = {};
    if (root) root.traverse(o => { for (const m of [].concat(o.material || [])) if (m.map && m.map.isCanvasTexture) out[m.name] = m.map.image; });
    return out;
  }

  function clear() {
    if (!root) return;
    for (const t of live.values()) t.dispose();
    live.clear();
    scene.remove(root);
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"]) if (m[k]) m[k].dispose();
        if (m.userData && m.userData._madeMap) m.userData._madeMap.dispose();
        m.dispose();
      }
    });
    root = null;
  }

  async function load(url) {
    clear();
    const gltf = await new GLTFLoader().loadAsync(url);
    root = gltf.scene;
    const box3 = new THREE.Box3();
    const sockets = [];
    root.traverse(o => {
      if (o.isMesh) {
        box3.expandByObject(o);
        if (/_liquid$/.test(o.name)) {                 // no liquid shader here: the inside shown full, half see-through
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.7;
        }
      }
      if (/^socket_/.test(o.name)) sockets.push(o);
    });
    scene.add(root);
    root.updateMatrixWorld(true);
    box3.setFromObject(root);
    const size = box3.getSize(new THREE.Vector3()), ctr = box3.getCenter(new THREE.Vector3()), r = Math.max(size.length(), 0.01);
    let tris = 0;
    root.traverse(o => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    for (const s of sockets) {                        // a marker and a short arrow along the socket's +Y
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * 0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0x5ad0ff, depthTest: false }));
      m.renderOrder = 10;
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), r * 0.08, 0x5ad0ff, r * 0.02, r * 0.012);
      s.add(m, a);
    }
    floor.scale.setScalar(r * 1.4);
    floor.position.y = box3.min.y - r * 0.0005;
    orbit.target.copy(ctr);
    orbit.dist = r * (opts.distance || 1.45);
    orbit.yaw = -0.6;
    orbit.pitch = 0.38;
    orbit.home = { yaw: orbit.yaw, pitch: orbit.pitch, dist: orbit.dist, target: ctr.clone() };
    return { size: [size.x, size.y, size.z], tris, sockets: sockets.map(s => s.name.replace(/^socket_/, "")), meshes: root.children.length };
  }

  return { load, clear, setSpin: v => { spin = !!v; }, dispose: () => { alive = false; clear(); renderer.dispose(); }, canvas: el,
    pick, setMaps, touchMaps, liveMaps };
}

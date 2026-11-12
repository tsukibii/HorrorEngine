// The Character Studio's "Hair editor v2.0" tab (docs/HAIR_V2.md; DECISIONS 2026-11-11, the go): hair grown from the
// fixed pores by the engine (engine.js, in a worker), not laid by hand. The panel: Wear it, the styles as cards, then
// every setting a slider or a dropdown, drawn from styles.js's CONTROLS; the hair is made again as a slider moves
// (a quick draft while it's dragged, the finished one when it's let go) and drawn on the character with the salon's
// hair shader. A character keeps `hair2: { on, style, set }`: the style it started from and what differs. While it's
// worn the salon's bake is hidden (and left out of an export); Export for Godot carries this hair as the salon's bake
// is carried: cards with shell normals, strand tangents and the occlusion (HSHair wears them), the painted scalp,
// short hair's shells, a tail on a chain of its own bones (HSJiggle swings it), the ties.
//
//   const H2 = mountHair2(ctx)      ctx: { el, $, status, api, rig, key (the scene's key light), who(), body() (the neutral
//                                          body's points), tris, changed(), onWear(on), reposed() }
//   H2.open(record)   a character opened (its `hair2`, or none)       H2.record()   what to save with it
//   H2.bodyChanged()  the body may have changed (compose)              H2.light()    each frame: the hair shader's lights
//   H2.worn()         is it on                                         H2.ready()    a promise: the finished hair of the settings as they are, on the body as it is
//   H2.group          what's drawn (under ctx.rig), H2.group.userData.rev counts each remake (the page's pose shift)
import * as THREE from "three";
import { STYLES, GROUPS, CONTROLS, FRINGES, settings, differs, lookOf } from "./styles.js";
import { frameMatrix } from "./body.js";
import { atlas as hairAtlas, record } from "./bake.js";
import { tile as shellTile } from "./shell.js";
import { hairUniforms, applyLook, lightHair, hairMaterial, atlasTexture, albedoTexture, strandsTexture } from "../hairshader.js";
import { albedo as hairAlbedo, linear } from "../hairtex.js";

const get = (o, path) => path.split(".").reduce((q, k) => (q == null ? undefined : q[k]), o);
const put = (o, path, v) => { const ks = path.split("."); let q = o; for (let i = 0; i < ks.length - 1; i++) q = q[ks[i]] && typeof q[ks[i]] === "object" ? q[ks[i]] : (q[ks[i]] = {}); q[ks[ks.length - 1]] = v; };
const clone = o => JSON.parse(JSON.stringify(o));

// short hair's shells in the Studio's view: hair_shell.gdshader's maths (the tile's hairs by layer), lit simply
const SHELL_VERT = /* glsl */`
attribute vec4 color;
varying float vF; varying float vLeft; varying vec2 vUv; varying vec3 vN;
void main() { vF = color.r; vLeft = color.g; vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHELL_FRAG = /* glsl */`
uniform sampler2D tile; uniform vec3 rootC, tipC, keyDir, keyC, ambientC;
varying float vF; varying float vLeft; varying vec2 vUv; varying vec3 vN;
void main() {
  vec4 t = texture2D(tile, vUv);
  float tall = smoothstep(vF - 0.08, vF + 0.04, t.r), there = smoothstep(t.g - 0.04, t.g + 0.04, vLeft), prof = smoothstep(0.0, 0.3, t.a - vF * 0.5);
  float a = clamp(tall * there * prof * 1.6, 0.0, 1.0);
  if (a < 0.03) discard;
  vec3 c = mix(rootC, tipC, smoothstep(0.0, 0.85, vF)) * (0.65 + 0.7 * t.b) * mix(0.45, 1.0, vF);
  float d = clamp((dot(normalize(vN), keyDir) + 0.6) / 1.6, 0.0, 1.0);
  gl_FragColor = vec4(c * (ambientC * 2.0 + keyC * d * 1.4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function mountHair2(ctx) {
  const { el, $, status, api, rig } = ctx, box = $("#hair2Rows");
  const H = { on: false, style: "bob_middle", set: {} };                 // the character's record
  let S = settings(H.style, H.set);                                       // every setting in full
  const group = new THREE.Group(); group.name = "hair2"; group.matrixAutoUpdate = false; group.visible = false; group.userData.rev = 0; rig.add(group);
  const ATL = hairAtlas(), U = hairUniforms(atlasTexture(ATL), lookOf(S));
  const cardsMat = hairMaterial(U); cardsMat.name = "hair_cards";
  const tileTex = (() => { const t = new THREE.DataTexture(new Uint8Array(shellTile().buffer), 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; })();
  const shellMat = new THREE.ShaderMaterial({ uniforms: { tile: { value: tileTex }, rootC: U.rootC, tipC: U.tipC, keyDir: U.keyDir, keyC: U.keyC, ambientC: U.ambientC }, vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, side: THREE.DoubleSide, alphaToCoverage: true });
  shellMat.name = "hair_shell";
  const scalpMat = new THREE.MeshStandardMaterial({ name: "hair_scalp", transparent: true, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  let scalpCanvas = null, scalpPainted = false;
  // ---- for a file (the page's fileLook asks: `userData.fileMaterial`): plain glTF materials carrying what Godot's HSHair reads
  const FILE = { look: "", cards: null, shell: null };
  const tidy = g => { for (const k of ["aTangent", "aTint", "aDepth"]) if (g.attributes[k]) g.deleteAttribute(k); };
  cardsMat.userData.fileMaterial = (x, g) => {
    tidy(g); const look = lookOf(S), key = JSON.stringify(look);
    if (FILE.look !== key || !FILE.cards) {
      FILE.look = key; FILE.cards = new THREE.MeshStandardMaterial({ name: "hair_cards", map: albedoTexture(ATL, hairAlbedo(ATL, look)), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55, aoMap: strandsTexture(ATL) });
      FILE.cards.userData = record(look);
    }
    return FILE.cards;
  };
  shellMat.userData.fileMaterial = (x, g) => {
    if (!FILE.shell) {
      const c = document.createElement("canvas"); c.width = c.height = 256; c.getContext("2d").putImageData(new ImageData(shellTile(), 256, 256), 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.flipY = false; t.colorSpace = THREE.NoColorSpace;
      FILE.shell = new THREE.MeshStandardMaterial({ name: "hair_shell", map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
    }
    FILE.shell.userData = { look: lookOf(S), studioShell: { version: 1, tile: "R each hair's height, G its number for thinning, B its shade, A its profile", color: "r the layer (0 the skin .. 1 the tips), g the hair left there" } };
    return FILE.shell;
  };

  // ---- the engine, in its worker ---------------------------------------------------------------------------------
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  let seq = 0, bodyKey = "", bodySent = false, bodyBusy = false, sentTris = false, want = null, shownSeq = 0, shownDraft = true, lastStats = null, showPores = false, waiters = [], bodyTimer = 0, fullTimer = 0, failed = "";
  const keyOf = P => { let a = 0, b = 0; for (let i = 0; i < P.length; i += 97) { a += P[i]; b += P[i] * (i % 13); } return `${P.length}|${a.toFixed(5)}|${b.toFixed(4)}`; };
  function sendBody(force) {
    if (!ctx.who()) return false;
    const P = ctx.body(), k = keyOf(P); if (!force && k === bodyKey && bodySent) return false;
    bodyKey = k; bodySent = true; bodyBusy = true; scalpPainted = false;
    worker.postMessage({ cmd: "body", P, T: sentTris ? null : ctx.tris }); sentTris = true;
    return true;
  }
  function ask(draft) {                                                 // the hair made again (a draft: quickly, while a slider is dragged)
    if (!H.on || !ctx.who()) return;
    if (!bodySent) sendBody(true);
    want = { cmd: "grow", seq: ++seq, settings: S, draft: !!draft, pores: showPores, repaint: !scalpPainted };
    if (!bodyBusy) { worker.postMessage(want); want = null; }
    if (draft) { clearTimeout(fullTimer); fullTimer = setTimeout(() => ask(false), 260); } else clearTimeout(fullTimer);
    stat();
  }
  worker.onmessage = e => {
    const m = e.data;
    if (m.cmd === "error") { failed = m.error; console.error("hair2:", m.error); status(`the hair editor: ${String(m.error).split("\n")[0]}`, "bad"); settle(); return; }
    if (m.cmd === "body") { bodyBusy = false; group.matrix.fromArray(frameMatrix(m.hf)); group.matrixWorldNeedsUpdate = true; if (want) { worker.postMessage(want); want = null; } return; }
    if (m.cmd === "hair") { if (m.seq < shownSeq) return; failed = ""; show(m); shownSeq = m.seq; shownDraft = m.draft; lastStats = m.stats; stat(); if (m.seq === seq && !m.draft) settle(); }
  };
  worker.onerror = e => { failed = e.message || "the worker failed"; status(`the hair editor: ${failed}`, "bad"); settle(); };
  const settle = () => { const w = waiters; waiters = []; w.forEach(f => f()); };
  const idle = () => !H.on || (shownSeq === seq && !shownDraft && !bodyBusy && !want) || !!failed;

  // ---- drawn on the character --------------------------------------------------------------------------------------
  const attr = (a, n) => new THREE.BufferAttribute(a, n);
  function cardsGeo(m) {
    const g = new THREE.BufferGeometry(), n = m.position.length / 3, at = new Float32Array(n * 3), tint = new Float32Array(n * 4), dep = new Float32Array(n);
    for (let i = 0; i < n; i++) { at[i * 3] = m.tangent[i * 4]; at[i * 3 + 1] = m.tangent[i * 4 + 1]; at[i * 3 + 2] = m.tangent[i * 4 + 2]; dep[i] = 0.028 * (m.uv1 ? m.uv1[i * 2 + 1] : 1); }
    g.setAttribute("position", attr(m.position, 3)); g.setAttribute("normal", attr(m.normal, 3)); g.setAttribute("tangent", attr(m.tangent, 4)); g.setAttribute("uv", attr(m.uv, 2));
    if (m.uv1) g.setAttribute("uv1", attr(m.uv1, 2));
    g.setAttribute("aTangent", attr(at, 3)); g.setAttribute("aTint", attr(tint, 4)); g.setAttribute("aDepth", attr(dep, 1));
    g.setIndex(attr(m.index, 1)); g.computeBoundingSphere();
    return g;
  }
  let poresObj = null;
  function show(m) {
    for (const o of [...group.children]) { group.remove(o); o.geometry?.dispose(); if (o.material && o.userData.own) o.material.dispose(); }
    poresObj = null;
    const add = (name, g, mat, data) => { const o = new THREE.Mesh(g, mat); o.name = name; o.frustumCulled = false; Object.assign(o.userData, data || {}); group.add(o); return o; };
    if (m.scalp) {
      if (!scalpCanvas || scalpCanvas.width !== m.scalp.size) { scalpCanvas = document.createElement("canvas"); scalpCanvas.width = scalpCanvas.height = m.scalp.size; scalpMat.map?.dispose(); const t = new THREE.CanvasTexture(scalpCanvas); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; scalpMat.map = t; scalpMat.needsUpdate = true; }
      if (m.scalp.rgba) { scalpCanvas.getContext("2d").putImageData(new ImageData(m.scalp.rgba, m.scalp.size, m.scalp.size), 0, 0); scalpMat.map.needsUpdate = true; scalpPainted = true; }   // (painted again only when the hairline, the parting or the colour changed)
      const g = new THREE.BufferGeometry(); g.setAttribute("position", attr(m.scalp.position, 3)); g.setAttribute("normal", attr(m.scalp.normal, 3)); g.setAttribute("uv", attr(m.scalp.uv, 2)); g.setIndex(attr(m.scalp.index, 1));
      add("hair_scalp", g, scalpMat).renderOrder = 1;
    }
    if (m.shell) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", attr(m.shell.position, 3)); g.setAttribute("normal", attr(m.shell.normal, 3)); g.setAttribute("tangent", attr(m.shell.tangent, 4)); g.setAttribute("uv", attr(m.shell.uv, 2)); g.setAttribute("color", attr(m.shell.color, 4)); g.setIndex(attr(m.shell.index, 1));
      add("hair_shell", g, shellMat);
    }
    if (m.hair && m.hair.index.length) add("hair_static", cardsGeo(m.hair), cardsMat).visible = !showPores;
    for (const t of m.tails) {
      if (!t.index.length) continue;
      const g = cardsGeo(t); g.setAttribute("along", attr(t.along, 1));
      add(`hair_${t.name}`, g, cardsMat, t.joints ? { jiggle: { name: `hair_${t.name}`, joints: t.joints, soft: t.soft } } : { rigid: "c_head" }).visible = !showPores;
    }
    for (const b of m.bands) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", attr(b.position, 3)); g.setAttribute("normal", attr(b.normal, 3)); g.setIndex(attr(b.index, 1));
      const c = linear(b.colour); add(b.name, g, new THREE.MeshStandardMaterial({ name: b.name, color: new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace), roughness: 0.85 }), { own: true, rigid: "c_head" });
    }
    if (m.pores && showPores) {                                         // the growing pores as dots (dark: loose hair; blue: the fringe; green: face-framing; red: tied)
      const n = m.pores.pos.length / 3, col = new Float32Array(n * 3), P = new Float32Array(m.pores.pos), tones = [[0.05, 0.05, 0.06], [0.2, 0.45, 1], [0.2, 0.8, 0.3], [0.95, 0.25, 0.2]];
      for (let i = 0; i < n; i++) { const c = tones[Math.min(3, m.pores.group[i])]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", attr(P, 3)); g.setAttribute("color", attr(col, 3));
      poresObj = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, depthTest: true })); poresObj.name = "hair2 pores"; poresObj.userData.own = true; poresObj.renderOrder = 2; group.add(poresObj);
    }
    group.userData.rev++; ctx.reposed?.();
  }
  function wear(on, quiet) {
    H.on = !!on; group.visible = H.on; wearBox.checked = H.on; ctx.onWear?.(H.on);
    if (H.on) { sendBody(false); ask(false); } else stat();
    if (!quiet) ctx.changed?.();
  }

  // ---- the panel -------------------------------------------------------------------------------------------------
  const syncs = [], UNDO = [], REDO = [];
  const snap = () => JSON.stringify({ style: H.style, set: H.set });
  let last = snap();
  function commit() {                                                   // a change made: kept for Undo, the finished hair
    const now = snap(); if (now !== last) { UNDO.push(last); if (UNDO.length > 80) UNDO.shift(); REDO.length = 0; last = now; ctx.changed?.(); }
    undoB.disabled = !UNDO.length; redoB.disabled = !REDO.length;
  }
  function changed(draft) { H.set = differs(H.style, S); applyLook(U, lookOf(S)); if (!H.on && !draft) wear(true, true); ask(draft); if (!draft) commit(); }
  function restore(text) { const r = JSON.parse(text); H.style = STYLES[r.style] ? r.style : H.style; H.set = r.set || {}; S = settings(H.style, H.set); applyLook(U, lookOf(S)); syncs.forEach(f => f()); mark(); ask(false); last = snap(); undoB.disabled = !UNDO.length; redoB.disabled = !REDO.length; ctx.changed?.(); }
  const wearBox = el("input", { type: "checkbox" });
  wearBox.onchange = () => wear(wearBox.checked);
  box.append(el("label", { className: "tog" }, wearBox, el("span", { textContent: "Wear this hair" }, el("small", { textContent: "Hair grown from fixed pores on the scalp, shaped by the settings below: no strands to place. While it's worn, the salon's hair (the Hair tab) is hidden and stays out of an export; turn this off to wear the salon's again." }))));
  const statLine = el("div", { className: "note", id: "hair2Stat" }); box.append(statLine);
  function stat() {
    if (!H.on) { statLine.textContent = "Not worn."; return; }
    if (failed) { statLine.textContent = `Couldn't make the hair: ${String(failed).split("\n")[0]}`; return; }
    const s = lastStats; if (!s) { statLine.textContent = "Making the hair…"; return; }
    const tris = s.triangles + (s.shellTriangles || 0) + (s.tailTriangles || 0), busy = shownSeq !== seq || shownDraft;
    statLine.textContent = `${s.cards} locks, ${tris.toLocaleString()} triangles${s.covered !== undefined ? `, the scalp ${Math.round(s.covered * 100)}% covered` : ""} · made in ${Math.round(s.total)} ms${busy ? " · finishing…" : ""}`;
  }
  // the styles as cards, by group
  const cards = {}, grid = el("div", { id: "hair2Grid" });
  const css = el("style", { textContent: `#hair2Grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; margin: 4px 0 8px; }
#hair2Grid h4 { grid-column: 1 / -1; margin: 6px 0 0; font-weight: 600; font-size: 11px; color: var(--dim); }
#hair2Grid .card { padding: 0; overflow: hidden; text-align: center; display: flex; flex-direction: column; background: #151619; }
#hair2Grid .card img, #hair2Grid .card i { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #5c6470; }
#hair2Grid .card span { display: block; font-size: 10.5px; padding: 3px 4px; line-height: 1.25; color: var(--ink); }
#hair2Grid .card.on { border-color: var(--gold); } #hair2Grid .card.on span { color: var(--gold); }
#hair2Rows .pick { display: grid; grid-template-columns: 110px 1fr; gap: 6px; align-items: center; margin: 3px 0; } #hair2Rows .pick span { color: var(--dim); } #hair2Rows .pick select, #hair2Rows .pick input { width: 100%; box-sizing: border-box; }
#hair2Rows .bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } #hair2Rows .bar button { flex: 1; white-space: nowrap; }
#hair2Preview { position: fixed; inset: 0; background: #000c; display: grid; place-items: center; z-index: 50; cursor: zoom-out; } #hair2Preview img { max-width: 96vw; max-height: 92vh; border: 1px solid var(--line); }` });
  document.head.append(css);
  box.append(el("h3", { textContent: "Styles" }), grid);
  let MINE = {};
  function drawCards() {
    grid.replaceChildren(); for (const k in cards) delete cards[k];
    const card = (id, label, pick, own) => {
      const b = el("button", { className: "card", title: label }), img = el("img", { loading: "lazy", alt: "" }); b.dataset.style = own ? `my:${id}` : id;
      img.onerror = () => img.replaceWith(el("i"));
      img.src = own ? `api/hair2/thumbs/my_${encodeURIComponent(id)}.jpg` : `api/hair2/thumbs/${id}.jpg`;
      b.append(img, el("span", { textContent: label })); b.onclick = pick; grid.append(b); if (!own) cards[id] = b;
      if (own) b.oncontextmenu = e => { e.preventDefault(); if (confirm(`Remove "${label}" from your styles?`)) api("api/hair2/styles", { delete: id }).then(r => { MINE = r.styles || {}; drawCards(); mark(); }).catch(err => status(err.message, "bad")); };
    };
    if (Object.keys(MINE).length) { grid.append(el("h4", { textContent: "Mine (right-click removes one)" })); for (const [id, m] of Object.entries(MINE)) card(id, m.label || id, () => { H.style = STYLES[m.style] ? m.style : "bob_middle"; H.set = clone(m.set || {}); S = settings(H.style, H.set); after(); }, true); }
    for (const [gid, glabel] of Object.entries(GROUPS)) {
      grid.append(el("h4", { textContent: glabel }));
      for (const [id, st] of Object.entries(STYLES)) if (st.group === gid) card(id, st.label, () => { H.style = id; H.set = {}; S = settings(id); after(); });
    }
  }
  const after = () => { applyLook(U, lookOf(S)); syncs.forEach(f => f()); mark(); if (!H.on) wear(true, true); else ask(false); commit(); };
  const mark = () => { for (const [id, b] of Object.entries(cards)) b.classList.toggle("on", id === H.style); };
  // every setting, by section
  for (const sec of CONTROLS) {
    const d = el("details", {}, el("summary", { textContent: sec.label })); if (sec.help) d.append(el("p", { className: "note", textContent: sec.help }));
    for (const r of sec.rows) {
      const [path, label, kind] = r;
      if (kind === "slide") {
        const [, , , lo, hi, step, k, help, extra] = r, none = extra && extra.none !== undefined ? extra.none : null;
        const shown = () => { const v = get(S, path); return v == null ? (none ?? lo) : Math.max(lo, Math.min(hi, v * k)); };
        const inp = el("input", { type: "range", min: lo, max: hi, step, value: shown() }), out = el("output");
        const text = () => { out.textContent = none !== null && +inp.value <= none ? "none" : (+inp.value).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0); };
        const row = el("div", { className: "row", title: help || "" }, el("span", { textContent: label }), inp, out); if (help && help.length > 3) row.append(el("small", { textContent: help }));
        const movedNow = () => row.classList.toggle("moved", JSON.stringify(get(S, path) ?? null) !== JSON.stringify(get(settings(H.style), path) ?? null));   // (lit while it differs from the style's own)
        const take = draft => { const v = +inp.value; put(S, path, none !== null && v <= none ? null : +(v / k).toFixed(6)); text(); movedNow(); changed(draft); };
        inp.oninput = () => take(true); inp.onchange = () => take(false);
        syncs.push(() => { inp.value = shown(); text(); movedNow(); });
        text(); d.append(row);
      } else if (kind === "pick") {
        const sel = el("select"); for (const [v, t] of r[3]) sel.append(el("option", { value: v, textContent: t }));
        sel.onchange = () => {
          if (path === "fringe.kind") { const f = { ...(FRINGES[sel.value] || {}) }; delete f.label; S.fringe = { ...S.fringe, ...f, kind: sel.value }; syncs.forEach(f2 => f2()); }   // a kind brings its own numbers
          else put(S, path, sel.value);
          changed(false);
        };
        syncs.push(() => { const v = get(S, path); sel.value = typeof v === "string" ? v : ""; if (path === "look" && typeof v !== "string") sel.selectedIndex = -1; });
        d.append(el("div", { className: "pick" }, el("span", { textContent: label }), sel));
      } else if (kind === "colour") {
        const inp = el("input", { type: "color" }); inp.oninput = () => { put(S, path, inp.value); changed(true); }; inp.onchange = () => { put(S, path, inp.value); changed(false); };
        syncs.push(() => { const v = get(S, path); inp.value = /^#[0-9a-f]{6}$/i.test(v || "") ? v : "#101010"; });
        d.append(el("div", { className: "pick" }, el("span", { textContent: label }), inp));
      }
    }
    if (sec.id === "colour") {                                           // the look's own colours, to change one at a time (a look of your own)
      const names = [["root", "Roots"], ["tip", "Lengths"], ["spec1", "Sharp highlight"], ["spec2", "Broad highlight"]];
      for (const [k, label] of names) {
        const inp = el("input", { type: "color" });
        const take = draft => { const base = { ...lookOf(S) }; base[k] = inp.value; if (k === "tip") base.inner = inp.value; base.label = "Your own"; S.look = base; changed(draft); };
        inp.oninput = () => take(true); inp.onchange = () => take(false);
        syncs.push(() => { inp.value = lookOf(S)[k]; });
        d.append(el("div", { className: "pick" }, el("span", { textContent: label }), inp));
      }
    }
    box.append(d);
  }
  // the bar: undo, the pores, the style's own settings, keep it as a style, Godot's picture
  const undoB = el("button", { textContent: "Undo", disabled: true }), redoB = el("button", { textContent: "Redo", disabled: true }), poresB = el("button", { textContent: "Show the pores", title: "The growing pores as dots, the hair hidden: dark the loose hair's, blue the fringe's, green the face-framing strands', red the tied hair's" });
  const resetB = el("button", { textContent: "Back to the style", title: "Every setting as the style's card has it" }), saveB = el("button", { textContent: "Save as my style…" }), godotB = el("button", { textContent: "Preview in Godot", title: "This head and hair pictured by Godot itself, as a game wears it (HSHair): front, three-quarter, side, back" });
  undoB.onclick = () => { if (!UNDO.length) return; REDO.push(snap()); restore(UNDO.pop()); };
  redoB.onclick = () => { if (!REDO.length) return; UNDO.push(snap()); restore(REDO.pop()); };
  poresB.onclick = () => { showPores = !showPores; poresB.classList.toggle("on", showPores); if (!H.on) wear(true, true); else ask(false); };
  resetB.onclick = () => { H.set = {}; S = settings(H.style); after(); };
  saveB.onclick = async () => {
    const name = (prompt("A name for this style", STYLES[H.style]?.label || "") || "").trim(); if (!name) return;
    try { const thumb = ctx.snapshot ? await ctx.snapshot() : null, r = await api("api/hair2/styles", { name, style: H.style, set: H.set, thumb }); MINE = r.styles || {}; drawCards(); mark(); status(`kept "${name}" with your styles`, "ok"); }
    catch (e) { status(e.message, "bad"); }
  };
  godotB.onclick = async () => {
    if (!ctx.who()) return status("make a character first", "bad");
    godotB.disabled = true; status("Godot is picturing this hair (a moment the first time: it sets its project up)…");
    try {
      await api(`api/people/${encodeURIComponent(ctx.who())}/body.bin`, new Blob([ctx.body()]));
      const r = await api(`api/hair2/godot/${encodeURIComponent(ctx.who())}`, { style: H.style, set: H.set });
      const o = el("div", { id: "hair2Preview", title: "Godot's own picture of this hair (click to close)" }, el("img", { src: `${r.sheet}?t=${Date.now()}` })); o.onclick = () => o.remove(); document.body.append(o);
      status(`Godot: ${r.said || "pictured"}`, "ok");
    } catch (e) { status(`Godot's picture: ${e.message}`, "bad"); }
    godotB.disabled = false;
  };
  box.append(el("div", { className: "bar" }, undoB, redoB, poresB), el("div", { className: "bar" }, resetB, saveB, godotB),
    el("p", { className: "note", textContent: "Hair lengths may reach the chest; anything longer would cut through clothes. Export for Godot carries this hair as it carries the salon's: Godot's HSHair wears it, a tail swings on its own bones (HSJiggle). docs/HAIR_V2.md." }));
  drawCards(); syncs.forEach(f => f()); mark(); stat();
  api("api/hair2/styles").then(r => { MINE = r.styles || {}; if (Object.keys(MINE).length) { drawCards(); mark(); } }).catch(() => null);

  return {
    group, get settings() { return S; }, get state() { return { on: H.on, style: H.style, set: H.set, stats: lastStats, seq, shownSeq, draft: shownDraft, failed }; },
    worn: () => H.on,
    record: () => (H.on || Object.keys(H.set).length || H.style !== "bob_middle" ? { on: H.on, style: H.style, set: clone(H.set) } : undefined),
    open(r) {                                                            // a character opened: its hair, or none
      UNDO.length = REDO.length = 0; lastStats = null; failed = ""; bodyKey = ""; bodySent = false;
      H.on = !!(r && r.on); H.style = r && STYLES[r.style] ? r.style : "bob_middle"; H.set = r && r.set ? clone(r.set) : {};
      S = settings(H.style, H.set); applyLook(U, lookOf(S)); syncs.forEach(f => f()); mark(); last = snap(); undoB.disabled = redoB.disabled = true;
      for (const o of [...group.children]) { group.remove(o); o.geometry?.dispose(); }
      group.visible = H.on; wearBox.checked = H.on; ctx.onWear?.(H.on); if (H.on) ask(false); stat();
    },
    use(style, set = {}, on = true) { H.style = STYLES[style] ? style : H.style; H.set = clone(set); S = settings(H.style, H.set); applyLook(U, lookOf(S)); syncs.forEach(f => f()); mark(); if (on && !H.on) wear(true, true); else ask(false); commit(); },
    wear,
    bodyChanged() { if (!H.on) return; clearTimeout(bodyTimer); bodyTimer = setTimeout(() => { if (H.on && sendBody(false)) ask(false); }, 450); },
    light() { if (!H.on) return; ctx.key.getWorldPosition(_k).sub(ctx.key.target.getWorldPosition(_t)); _c.copy(ctx.key.color).multiplyScalar(ctx.key.intensity * 0.6); lightHair(U, _k, _c, _f, null); },
    async ready() {                                                      // (for an export: the finished hair, the pores' dots off)
      if (!H.on) return true;
      if (showPores) { showPores = false; poresB.classList.remove("on"); ask(false); }
      clearTimeout(bodyTimer); if (sendBody(false) || shownDraft || shownSeq !== seq) ask(false);
      const t0 = performance.now();
      while (!idle() && performance.now() - t0 < 60000) await new Promise(ok => { waiters.push(ok); setTimeout(ok, 500); });
      return idle() && !failed;
    },
  };
}
const _k = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Color(), _f = new THREE.Vector3(-0.3, 1, 0.4);

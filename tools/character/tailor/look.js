// How the tailor's garments are drawn in a page (the Character Studio, the contact sheet): their geometry with the
// fabric coordinates (tailor/uv.js), the shade along their edges, and their material: a colour or a pattern, the
// fabric's grain over it at its real size (tailor/fabric.js, after Woohill's surfaces), a print on one panel, the
// fabric's gloss and relief; fishnet, lace and sheer tights let the skin through.
import * as THREE from "three";
import { SURFACES, surfaceTile, surfaceRelief, patternTile, textPrint } from "./fabric.js";
import { PARTS } from "./uv.js";

/** a garment part ({P, T, N, UV, PART, S} from tailor.js) as a BufferGeometry: position, normal, uv (metres), part, color (the edge shade) */
export function geometry(q) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(q.P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(q.N, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(q.UV, 2));
  g.setAttribute("uvm", g.attributes.uv);                          // the fabric coordinates, for the fabric's own shader code
  g.setAttribute("part", new THREE.BufferAttribute(q.PART, 1));
  const shade = new Float32Array(q.S.length * 3);
  for (let i = 0; i < q.S.length; i++) shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = q.S[i];
  g.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  g.setIndex(new THREE.BufferAttribute(q.T, 1));
  g.computeBoundingSphere();
  return g;
}

let CHECKER = null;
/** a 5 cm checker with a 25 cm grid in colour: what the fabric coordinates look like (their scale, their seams) */
function checker() {
  if (CHECKER) return CHECKER;
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { x.fillStyle = (i + j) % 2 ? "#e8e8e8" : "#606060"; x.fillRect(i * 51.2, j * 51.2, 51.2, 51.2); }
  x.strokeStyle = "#e0402a"; x.lineWidth = 4; x.strokeRect(0, 0, 256, 256); x.fillStyle = "#2a70e0"; x.fillRect(0, 0, 20, 20);
  CHECKER = new THREE.CanvasTexture(c); CHECKER.wrapS = CHECKER.wrapT = THREE.RepeatWrapping; CHECKER.repeat.set(4, 4); CHECKER.colorSpace = THREE.SRGBColorSpace;
  return CHECKER;
}

const TEX = new Map();
const texture = (canvasOf, key, srgb) => {
  if (TEX.has(key)) return TEX.get(key);
  const t = new THREE.CanvasTexture(canvasOf()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  TEX.set(key, t); return t;
};
const IMAGES = new Map();
/** a print's picture as a texture: {text, ink} set in type, or {image: a data URL} (loaded, then `onload`) */
function printTexture(pr, onload) {
  if (pr.text) return texture(() => textPrint(pr.text, pr.ink || "#ffffff"), "text|" + pr.text + "|" + pr.ink, true);
  if (!pr.image) return null;
  let t = IMAGES.get(pr.image);
  if (!t) { t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; onload?.(); }; im.src = pr.image; IMAGES.set(pr.image, t); }
  return t;
}

/**
 * The material for a garment part: `look` is the garment's ({color, surface, pattern: {kind, colors, size},
 * print: {text, ink | image, part, u, v, w, rot}, denier}), and a part that isn't the garment's fabric (a belt, a
 * button) keeps its own colour on `trim` (a surface). look.debug === "uv" shows the fabric coordinates.
 */
export function material(q, look = {}) {
  if (look.debug === "uv") return new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.9, vertexColors: true });
  const own = q.fabric === false || !look.surface && !look.pattern;
  const surface = q.surface || (q.fabric === false ? look.trim : look.surface) || "flat", S = SURFACES[surface] || SURFACES.flat, over = S[4];
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, vertexColors: true, transparent: over, side: THREE.FrontSide });
  const fab = texture(() => surfaceTile(surface), "s|" + surface, false).clone(); fab.needsUpdate = true; fab.repeat.set(1 / S[1], 1 / S[1]);
  if (S[3] > 0) { m.bumpMap = texture(() => surfaceRelief(surface), "r|" + surface, false).clone(); m.bumpMap.needsUpdate = true; m.bumpMap.repeat.set(1 / S[1], 1 / S[1]); m.bumpScale = 2.5 * S[3]; }
  const pat = q.fabric !== false && look.pattern && look.pattern.kind && look.pattern.kind !== "none" ? look.pattern : null;
  const pr = q.fabric !== false && look.print && (look.print.text || look.print.image) ? look.print : null;
  const U = {
    uColor: { value: new THREE.Color(own ? q.color : look.color || q.color) },
    uFabric: { value: fab }, uFabricScale: { value: 1 / S[1] }, uGloss: { value: S[2] },
    uOver: { value: over ? (surface === "sheer" ? 2 : 1) : 0 }, uDenier: { value: look.denier ?? 0.55 },
    uPattern: { value: pat ? texture(() => patternTile(pat.kind, pat.colors || []), "p|" + pat.kind + "|" + (pat.colors || []).join(), true) : null },
    uPatternOn: { value: pat ? 1 : 0 }, uPatternScale: { value: 1 / ((pat?.size) || 0.04) },
    uPrint: { value: pr ? printTexture(pr, () => { m.needsUpdate = true; }) : null }, uPrintOn: { value: pr ? 1 : 0 },
    uPrintRect: { value: new THREE.Vector4(pr?.u ?? 0, pr?.v ?? 1.2, pr?.w ?? 0.18, (pr?.w ?? 0.18) * (pr?.text ? 0.25 : pr?.aspect ?? 1)) },
    uPrintRot: { value: (pr?.rot ?? 0) * Math.PI / 180 }, uPrintPart: { value: Math.max(0, PARTS.indexOf(pr?.part || "front")) },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 uvm;\nattribute float part;\nvarying vec2 vUvm;\nvarying float vPart;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUvm = uvm; vPart = part;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec2 vUvm; varying float vPart;
uniform vec3 uColor; uniform sampler2D uFabric; uniform float uFabricScale, uGloss, uOver, uDenier;
uniform sampler2D uPattern; uniform float uPatternOn, uPatternScale;
uniform sampler2D uPrint; uniform float uPrintOn, uPrintRot, uPrintPart; uniform vec4 uPrintRect;`)
      .replace("#include <map_fragment>", `
  vec3 cloth = uColor;
  if (uPatternOn > 0.5) cloth = texture2D(uPattern, vUvm * uPatternScale).rgb;
  vec4 grain = texture2D(uFabric, vUvm * uFabricScale);
  if (uPrintOn > 0.5 && abs(vPart - uPrintPart) < 0.5) {                     // the print, on its panel
    vec2 d = vUvm - uPrintRect.xy; float c = cos(uPrintRot), s = sin(uPrintRot);
    vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / uPrintRect.zw + 0.5;
    if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) { vec4 ink = texture2D(uPrint, q); cloth = mix(cloth, ink.rgb, ink.a); }
  }
  diffuseColor.rgb *= cloth * grain.rgb * 2.0;
  if (uOver > 1.5) diffuseColor.a = uDenier * (0.85 + 0.15 * grain.a);     // sheer: the nylon's denier
  else if (uOver > 0.5) diffuseColor.a = grain.a;                          // a net: the skin in its holes`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor *= 1.0 - 0.75 * uGloss * (0.6 + 0.8 * grain.g);")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  if (uOver > 1.5) { float f = 1.0 - abs(dot(normal, normalize(vViewPosition))); diffuseColor.a = mix(diffuseColor.a, 1.0, pow(f, 1.4)); }   // tights darken where they turn away`);
  };
  m.customProgramCacheKey = () => "tailor" + (m.bumpMap ? "b" : "") + (over ? "o" : "");
  return m;
}

/** a mesh of a garment part, named and tagged with its garment */
export function mesh(q, garment, look) {
  const m = new THREE.Mesh(geometry(q), material(q, look));
  m.name = q.name; m.userData.garment = garment; m.userData.q = { name: q.name, color: q.color, fabric: q.fabric, surface: q.surface }; m.castShadow = m.receiveShadow = !(SURFACES[q.surface || look?.surface]?.[4]);
  return m;
}

/** every part of the garments worn as one OBJ: positions, fabric coordinates (metres), normals; one object a part */
export function objText(meshes, header) {
  const out = [`# ${header}`, "# vt in metres round each part (u round, v up): a fabric tile of size s takes vt / s"];
  let base = 0;
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, T = g.index.array;
    out.push(`o ${m.name}`, `# colour #${m.material.color.getHexString()}`);
    for (let i = 0; i < P.length; i += 3) out.push(`v ${P[i].toFixed(5)} ${P[i + 1].toFixed(5)} ${P[i + 2].toFixed(5)}`);
    for (let i = 0; i < U.length; i += 2) out.push(`vt ${U[i].toFixed(5)} ${U[i + 1].toFixed(5)}`);
    for (let i = 0; i < N.length; i += 3) out.push(`vn ${N[i].toFixed(4)} ${N[i + 1].toFixed(4)} ${N[i + 2].toFixed(4)}`);
    for (let t = 0; t < T.length; t += 3) { const a = T[t] + 1 + base, b = T[t + 1] + 1 + base, c = T[t + 2] + 1 + base; out.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`); }
    base += P.length / 3;
  }
  return out.join("\n") + "\n";
}

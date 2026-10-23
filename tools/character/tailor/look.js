// How the tailor's garments are drawn in a page (the Character Studio, the contact sheet): their geometry with the
// fabric coordinates (tailor/uv.js), the shade along their edges, and their material.
import * as THREE from "three";

/** a garment part ({P, T, N, UV, PART, S} from tailor.js) as a BufferGeometry: position, normal, uv (metres), part, color (the edge shade) */
export function geometry(q) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(q.P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(q.N, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(q.UV, 2));
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

/** the material for a garment part; look.debug === "uv" shows its fabric coordinates */
export function material(q, look = {}) {
  if (look.debug === "uv") return new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.9, vertexColors: true });
  return new THREE.MeshStandardMaterial({ color: q.color, roughness: 0.86, vertexColors: true });
}

/** a mesh of a garment part, named and tagged with its garment */
export function mesh(q, garment, look) {
  const m = new THREE.Mesh(geometry(q), material(q, look));
  m.name = q.name; m.userData.garment = garment; m.castShadow = m.receiveShadow = true;
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

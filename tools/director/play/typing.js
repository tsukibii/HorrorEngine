// A thought that types itself out (STORY_FORMAT §9.15, HANDOFF_DIRECTOR_TODO §7): `breaks` (a memory flicker: it types
// out, its last letters glitch, and it's gone) and `retype` (typed, then erased back to where the two part and typed
// again as these words: "Natsuki." becoming "Natsu."). What shows t seconds in, as plain functions: the HUD, the Watch
// and DESK use the same ones, and storylib.typed_secs counts the same time. A thought with neither shows whole.
export const TYPE_CPS = 28;                        // letters a second as it types
const ERASE_CPS = 70, HOLD = 0.6, GLITCH = 0.45;   // erased faster; held before it's erased; how long it breaks up
const pause = ch => ch === "," || ch === ";" ? 0.12 : ".!?".includes(ch) ? 0.3 : ch === "…" || ch === "—" ? 0.35 : 0;

// the time to type s, letter by letter, with a pause after punctuation (none after the last)
export function typeSecs(s) {
  let t = 0; const a = [...String(s || "")];
  a.forEach((ch, i) => { t += 1 / TYPE_CPS; if (i < a.length - 1) t += pause(ch); });
  return t;
}
// how many letters of s are typed t seconds in
function lettersAt(s, t) {
  const a = [...String(s || "")]; let u = 0;
  for (let i = 0; i < a.length; i++) { u += 1 / TYPE_CPS; if (u > t) return i; if (i < a.length - 1) u += pause(a[i]); }
  return a.length;
}
const common = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

// the whole of it: typing, holding, erasing, retyping or breaking up (its hold to read after is the caller's)
export function typedSecs(text, { retype, breaks } = {}) {
  if (!retype && !breaks) return 0;
  const a = [...String(text || "")];
  let t = typeSecs(text);
  if (retype) { const b = [...String(retype)], k = common(a, b); t += HOLD + (a.length - k) / ERASE_CPS + typeSecs(b.slice(k).join("")); }
  if (breaks) t += GLITCH;
  return t;
}
// what shows t seconds in: { shown, glitch (0..1 while it breaks up, else 0), done }
export function typedAt(text, { retype, breaks } = {}, t) {
  const a = [...String(text || "")];
  if (!retype && !breaks) return { shown: a.join(""), glitch: 0, done: true };
  const t1 = typeSecs(text);
  if (t < t1) return { shown: a.slice(0, lettersAt(text, t)).join(""), glitch: 0, done: false };
  let u = t - t1, cur = a;
  if (retype) {
    const b = [...String(retype)], k = common(a, b), erase = (a.length - k) / ERASE_CPS, rest = b.slice(k).join("");
    if (u < HOLD) return { shown: a.join(""), glitch: 0, done: false };
    u -= HOLD;
    if (u < erase) return { shown: a.slice(0, a.length - Math.floor(u * ERASE_CPS)).join(""), glitch: 0, done: false };
    u -= erase;
    const tr = typeSecs(rest);
    if (u < tr) return { shown: b.slice(0, k + lettersAt(rest, u)).join(""), glitch: 0, done: false };
    u -= tr; cur = b;
  }
  if (breaks) {
    if (u < GLITCH) return { shown: cur.join(""), glitch: Math.min(1, u / GLITCH), done: false };
    return { shown: "", glitch: 0, done: true };
  }
  return { shown: cur.join(""), glitch: 0, done: true };
}
// a glitching line's look: its last letters swapped for broken ones, more of them as it breaks (seeded by the time, so
// a frame's the same however often it's drawn)
const BROKEN = "▓▒░█▚▞";
export function glitched(s, g, seed = 0) {
  const a = [...s], n = Math.min(a.length, 1 + Math.round(g * 6));
  for (let i = a.length - n; i < a.length; i++) if (a[i] !== " ") a[i] = BROKEN[Math.abs(Math.floor(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453)) % BROKEN.length];
  return a.join("");
}

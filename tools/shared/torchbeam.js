// The flashlight's battery and its beam (docs/FLASHLIGHT_PLAN.md §1, DECISIONS 2026-11-07): an item's `torch` with a
// `battery` (the seconds of light from full) drains while it's on; the beam it gives by its `kind`, from its charge:
//   bulb (the default): an old torch with a filament, dimmer and warmer from the start (b = √charge, its kelvin toward
//        2100 K as (1 − charge)²), browning out under its `low` (dips to 40 % for 0.06 to 0.2 s, every 3 s at `low`
//        closing to every 0.4 s near empty);
//   led: full and white down to `low`, then three blinks (off 0.08 s, on 0.12 s: a driver's warning) and a low mode of
//        35 %, under 0.05 a slow strobe (0.4 s on, 0.15 s off).
// Its reach is the range × √b (light falls with the square of distance). Plain functions of the clock, hashed the way
// the lamps' flicker is (shared/flicker.js), so Godot's torch_beam.gd draws the same beam on every run.
export const KINDS = { bulb: { kelvin: 3200, low: 0.2 }, led: { kelvin: 6000, low: 0.15 } };
export const WARM = 2100;                         // a bulb's colour as it dies (K)
export const DEAD_AT = 0.03;                      // a bulb under this is dying (its stutter), an LED strobes under 0.05
export const REST_SECS = 30, REST_GAIN = 0.03, RESTS = 2;   // `rest`: a bulb switched off this long gives this much more, twice a set
export const CHANGE_SECS = 2;                     // changing the batteries: the dark while it's done

// the hash the lamps' flicker uses (shared/flicker.js), 0..1
export function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// an item's torch settings with the battery's own: kind, battery (s, 0 = it never runs down), low, rest, charge
export function batteryOf(t) {
  const o = t && typeof t === "object" ? t : {}, kind = KINDS[o.kind] ? o.kind : "bulb";
  return { kind, battery: +o.battery > 0 ? +o.battery : 0, low: o.low !== undefined ? Math.max(0, Math.min(1, +o.low)) : KINDS[kind].low,
    rest: o.rest === true && kind === "bulb", charge: o.charge !== undefined ? Math.max(0, Math.min(1, +o.charge)) : 1,
    kelvin: +o.kelvin || (+o.battery > 0 ? KINDS[kind].kelvin : 0) };
}

// the beam now: { b: its brightness (0..1), kelvin (0: the torch's own), reach (× its range) }. st: { kind, charge,
// low, lowAt (the clock when it ran under low, or null), kelvin (its colour full) }
export function beam(st, T) {
  const c = Math.max(0, st.charge), low = st.low;
  let b = 1, kelvin = st.kelvin || 0;
  if (st.kind === "led") {
    const t = st.lowAt !== null && st.lowAt !== undefined ? T - st.lowAt : -1;
    if (c >= low) b = 1;
    else if (c < 0.05) b = ((T % 0.55) + 0.55) % 0.55 < 0.4 ? 0.35 : 0;          // a slow strobe
    else if (t >= 0 && t < 0.6) b = (t % 0.2) < 0.08 ? 0 : 1;                      // three blinks
    else b = 0.35;                                                                 // its low mode
  } else {
    b = Math.sqrt(c);
    if (kelvin) kelvin = kelvin - (kelvin - WARM) * (1 - c) * (1 - c);
    if (c < low && c > 0) {                                                        // brownouts, closer as it empties
      const g = 0.4 + (3 - 0.4) * Math.max(0, Math.min(1, (c - DEAD_AT) / Math.max(1e-6, low - DEAD_AT)));
      const i = Math.floor(T / g), at = i * g + hash(i, 4091) * g * 0.6, len = 0.06 + 0.14 * hash(i, 4093);
      if (T >= at && T < at + len) b *= 0.4;
    }
  }
  return { b, kelvin, reach: Math.sqrt(Math.max(0, b)) };
}

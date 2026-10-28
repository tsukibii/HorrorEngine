// Player abilities: what the player can do (GAMEPLAY_PLAN §3, §5). Each runs every frame (`update`), and may answer
// keys (`key`) and the mouse (`mouse`). The runtime owns the player (feet, yaw, pitch, eye height) and the collision.
import { register } from "./parts.js";
import { EYES } from "../stage.js";

register("ability", "look", {
  settings: { sens: 0.12, pitch: 80 },                     // degrees a mouse count; how far up and down
  mouse: (rt, dx, dy, s) => {
    const p = rt.player;
    p.yaw -= dx * s.sens;
    let pm = s.pitch;
    if (p.limit) {                                          // held to a cone (hiding: out of the door)
      const d = ((p.yaw - p.limit.yaw) % 360 + 540) % 360 - 180;
      p.yaw = p.limit.yaw + Math.max(-p.limit.dy, Math.min(p.limit.dy, d)); pm = Math.min(pm, p.limit.dp);
    }
    p.pitch = Math.max(-pm, Math.min(pm, p.pitch - dy * s.sens));
  },
});

register("ability", "walk", {
  settings: { speed: 1.4, run: 2.8, crouched: 0.7, radius: 0.25, step: 0.35 },   // m/s walking, running (Shift held) and crouched; body radius; step up
  update: (rt, dt, s) => {
    const k = rt.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    rt.player.running = !rt.player.crouched && !!(k.ShiftLeft || k.ShiftRight) && f > 0;     // forward only, standing
    if (!f && !r) return;
    const a = rt.player.yaw * Math.PI / 180, len = Math.hypot(f, r), v = (rt.player.crouched ? s.crouched : rt.player.running ? s.run : s.speed) * dt / len;
    // forward is (cos yaw, -sin yaw) in three's x, z (story y is three's -z); right is (sin yaw, cos yaw)
    rt.move((Math.cos(a) * f + Math.sin(a) * r) * v, (-Math.sin(a) * f + Math.cos(a) * r) * v, s);
  },
});

register("ability", "crouch", {
  settings: { mode: "toggle", key: "KeyC", ease: 8 },      // "toggle" or "hold" (the player's setting)
  key: (rt, e, down, s) => {
    if (e.code !== s.key) return;
    if (s.mode === "hold") rt.player.crouched = down;
    else if (down && !e.repeat) rt.player.crouched = !rt.player.crouched;
  },
  update: (rt, dt, s) => {
    const p = rt.player, want = p.crouched ? EYES.crouch : EYES.stand;
    p.eye += (want - p.eye) * Math.min(1, dt * s.ease);
  },
});

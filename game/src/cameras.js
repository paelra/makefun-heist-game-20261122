// Security cameras: wall-mounted, sweeping cones, EMP-disabled. A camera that
// sees the thief feeds the alarm meter instead of catching outright, so a
// camera sighting is a rising cost, not an instant loss — unless the alarm is
// already high. An EMP pulse shuts the nearest camera down for a few seconds.
import { VISION } from './config.js';
import { visionStrength } from './guards.js';

export function createCameras(level) {
  return level.cameraMounts.map((mount, i) => ({
    id: i,
    x: mount.x,
    y: mount.y,
    baseAngle: mount.baseAngle,
    sweep: mount.sweep,
    sweepSpeed: level.meta.cameraSweep,
    phase: i * 1.7,
    angle: mount.baseAngle,
    disabledTimer: 0,
    spotting: 0, // 0..1, how hard this camera is seeing the thief right now
  }));
}

/** Advance camera sweeps and vision. Returns summed sighting strength (per second). */
export function updateCameras(cameras, dt, time, player, world, running) {
  let strengthSum = 0;
  for (const cam of cameras) {
    if (cam.disabledTimer > 0) {
      cam.disabledTimer -= dt;
      cam.spotting = 0;
      continue;
    }
    cam.angle = cam.baseAngle + Math.sin(time * cam.sweepSpeed + cam.phase) * cam.sweep;
    const strength = visionStrength(
      { x: cam.x, y: cam.y, angle: cam.angle, range: VISION.cameraRange, halfAngle: VISION.cameraHalfAngle },
      player, world, running,
    );
    cam.spotting = strength;
    strengthSum += strength;
  }
  return strengthSum;
}

/** Disable the nearest camera within `radius` of (x, y). Returns the camera or null. */
export function empNearestCamera(cameras, x, y, radius, seconds) {
  let best = null;
  let bestDist = radius;
  for (const cam of cameras) {
    const dist = Math.hypot(cam.x - x, cam.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = cam;
    }
  }
  if (best) best.disabledTimer = seconds;
  return best;
}

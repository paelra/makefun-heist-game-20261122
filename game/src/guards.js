// Guards: patrol routes, vision cones and detection. A guard walks its
// waypoints, pauses and looks around at each one, and sweeps its cone. When the
// thief is inside the cone with a clear line of sight, suspicion fills; full
// suspicion means caught. Cover blocks sight, shadow zones hide the thief, and
// running fills suspicion faster. A decoy coin makes a guard walk over and
// investigate instead of patrolling.
import { VISION } from './config.js';
import { segmentBlocked, inShadow } from './world.js';

export const GUARD_STATE = { PATROL: 'patrol', INVESTIGATE: 'investigate', ALERT: 'alert' };

export function createGuards(level) {
  return level.guardRoutes.map((route, i) => ({
    id: i,
    route,
    waypoint: 0,
    x: route[0].x,
    y: route[0].y,
    angle: 0,
    speed: level.meta.guardSpeed,
    suspicion: 0,
    state: GUARD_STATE.PATROL,
    pauseTimer: 0,
    investigate: null, // {x, y, timer}
    seenFlash: 0, // counts down after a fresh sighting, for the render pulse
  }));
}

/** Smallest absolute angle between two headings, 0..PI. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI;
  return Math.abs(d);
}

/**
 * How strongly `eye` (x, y, facing angle, range, half-angle) can see the thief
 * right now: 0 when out of the cone, blocked, or hidden in shadow; up to ~1
 * at point-blank. Running multiplies it; distance scales it.
 */
export function visionStrength(eye, player, world, running) {
  const dx = player.x - eye.x;
  const dy = player.y - eye.y;
  const dist = Math.hypot(dx, dy);
  if (dist > eye.range || dist < 1) return 0;
  if (angleDiff(Math.atan2(dy, dx), eye.angle) > eye.halfAngle) return 0;
  if (inShadow(player.x, player.y, world.shadows)) return 0;
  const blockers = [...world.walls, ...world.cover];
  if (VISION.coverBlocks && segmentBlocked(eye.x, eye.y, player.x, player.y, blockers)) return 0;
  let strength = 1 - dist / eye.range;
  if (dist < eye.range * 0.4) strength *= VISION.closeBonus;
  if (running) strength *= 1.6;
  return Math.min(1.6, strength);
}

/** Move one guard a step. Returns 'caught' when its suspicion fills. */
export function updateGuard(guard, dt, player, world, running, time) {
  const target = guard.investigate;
  if (target) {
    guard.state = GUARD_STATE.INVESTIGATE;
    const arrived = moveToward(guard, target.x, target.y, dt);
    if (arrived) {
      target.timer -= dt;
      guard.angle = target.baseAngle + Math.sin(time * 3.3 + guard.id) * 0.6;
      if (target.timer <= 0) guard.investigate = null;
    }
  } else {
    guard.state = GUARD_STATE.PATROL;
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      // Look around while paused at a waypoint: a slow sweep around the
      // facing the guard arrived with (game time, so replays are deterministic).
      if (guard.pauseAngle === undefined) guard.pauseAngle = guard.angle;
      guard.angle = guard.pauseAngle + Math.sin(time * 1.4 + guard.id * 2) * 0.5;
    } else {
      guard.pauseAngle = undefined;
      const wp = guard.route[guard.waypoint];
      const arrived = moveToward(guard, wp.x, wp.y, dt);
      if (arrived) {
        guard.waypoint = (guard.waypoint + 1) % guard.route.length;
        guard.pauseTimer = 0.9;
      }
    }
  }

  // Vision check against the player.
  const strength = visionStrength(
    { x: guard.x, y: guard.y, angle: guard.angle, range: VISION.guardRange, halfAngle: VISION.guardHalfAngle },
    player, world, running,
  );
  if (strength > 0) {
    guard.suspicion += strength * VISION.fillPerSecond * dt;
    guard.seenFlash = 0.25;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - VISION.decayPerSecond * dt);
  }
  if (guard.seenFlash > 0) guard.seenFlash -= dt;
  return guard.suspicion >= 1 ? 'caught' : null;
}

/** Step toward (tx, ty) at the guard's speed; returns true on arrival. */
function moveToward(guard, tx, ty, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) return true;
  const step = Math.min(dist, guard.speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 3;
}

/** Send a guard to investigate a decoy landing spot. */
export function lureGuard(guard, x, y, seconds) {
  guard.investigate = { x, y, timer: seconds, baseAngle: guard.angle };
  guard.suspicion = Math.max(0, guard.suspicion - 0.4);
}

// Tools: EMP pulse, decoy coin and lockpick. Every tool costs score and a
// limited charge, so the player spends the night's own take to buy safety —
// the loadout is a real tradeoff, not a free win button.
import { TOOLS, ALARM } from './config.js';
import { empNearestCamera } from './cameras.js';
import { lureGuard } from './guards.js';

export function createTools() {
  return {
    emp: TOOLS.empCharges,
    decoy: TOOLS.decoyCharges,
    lockpick: TOOLS.lockpickUses,
    lockpickActive: false, // the next vault crack is fast
    scoreSpent: 0,
  };
}

/** Fire an EMP at the nearest camera. Returns a short result string. */
export function useEmp(tools, cameras, x, y) {
  if (tools.emp <= 0) return 'no-emp';
  const cam = empNearestCamera(cameras, x, y, TOOLS.empRadius, TOOLS.empDisableSeconds);
  if (!cam) return 'no-camera';
  tools.emp -= 1;
  tools.scoreSpent += TOOLS.empCost;
  return 'emp-ok';
}

/**
 * Toss a decoy coin toward (x, y): the nearest guard in range walks over to
 * investigate. Returns a short result string.
 */
export function useDecoy(tools, guards, x, y) {
  if (tools.decoy <= 0) return 'no-decoy';
  let best = null;
  let bestDist = TOOLS.decoyLureRadius;
  for (const guard of guards) {
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  if (!best) return 'no-guard';
  lureGuard(best, x, y, TOOLS.decoyInvestigateSeconds);
  tools.decoy -= 1;
  tools.scoreSpent += TOOLS.decoyCost;
  return 'decoy-ok';
}

/** Arm the lockpick: the next vault crack is fast. Returns a result string. */
export function useLockpick(tools) {
  if (tools.lockpick <= 0) return 'no-pick';
  if (tools.lockpickActive) return 'already-armed';
  tools.lockpick -= 1;
  tools.lockpickActive = true;
  tools.scoreSpent += TOOLS.lockpickCost;
  return 'pick-ok';
}

/** Score for a night: loot taken minus tool spend, never below zero. */
export function nightScore(lootValue, tools) {
  return Math.max(0, lootValue - tools.scoreSpent);
}

/** Lasers: a beam is live while sin(time * 2PI/period + phase) > 0. */
export function laserLive(laser, time) {
  return Math.sin((time * Math.PI * 2) / laser.period + laser.phase) > 0;
}

/**
 * True when the segment the player just crossed trips a live laser beam.
 * The check is segment-vs-segment: the player's movement step against the
 * beam line. Crossing a live beam adds a big alarm spike (see alarm.js).
 */
export function crossedLaser(laser, time, px, py, qx, qy) {
  if (!laserLive(laser, time)) return false;
  return segmentsCross(px, py, qx, qy, laser.x1, laser.y1, laser.x2, laser.y2);
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// The alarm meter: the night's shared tension. It rises while any guard or
// camera sees the thief and when a laser is tripped, and decays slowly while
// the thief stays hidden. At max it triggers lockdown: a short countdown during
// which the thief must reach the exit with the loot, or the night is lost.
import { ALARM } from './config.js';

export function createAlarm(levelMeta) {
  return {
    value: 0,
    lockdown: false,
    lockdownTimer: levelMeta.lockdownSeconds,
    lockdownSeconds: levelMeta.lockdownSeconds,
    decay: levelMeta.alarmDecay,
  };
}

/**
 * Advance the alarm one step. `sightPerSecond` is the combined rate from
 * guards and cameras seeing the thief this frame. Returns 'lockdown' the
 * moment the meter maxes out, 'lockdown-lost' when the countdown expires,
 * or null.
 */
export function updateAlarm(alarm, dt, sightPerSecond, laserTripped) {
  if (alarm.lockdown) {
    alarm.lockdownTimer -= dt;
    if (alarm.lockdownTimer <= 0) return 'lockdown-lost';
    return null;
  }
  let delta = sightPerSecond * dt - alarm.decay * dt;
  if (laserTripped) delta += ALARM.laserTrip;
  alarm.value = Math.max(0, Math.min(ALARM.max, alarm.value + delta));
  if (alarm.value >= ALARM.max) {
    alarm.lockdown = true;
    alarm.lockdownTimer = alarm.lockdownSeconds;
    return 'lockdown';
  }
  return null;
}

/** HUD band for the alarm meter: calm, warm or hot. */
export function alarmBand(alarm) {
  if (alarm.value >= 75) return 'hot';
  if (alarm.value >= 40) return 'warn';
  return 'calm';
}

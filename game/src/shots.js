// Deterministic screenshot scenes behind ?shot=start|play|end&seed=N. Each one
// plays the real rules forward from a fresh night with a simple autopilot, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The autopilot heads for the vault, waits out the
// guards in the dark when the vault area is hot, grabs the vault, then runs
// for the exit — a careful thief, not a perfect one.
import { STEP, PLAYER } from './config.js';
import { SCREEN_PLAY } from './render.js';
import { visionStrength } from './guards.js';
import { VISION } from './config.js';
import { inShadow } from './world.js';
import { stepGame } from './main.js';

const START_SECONDS = 10;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;

/** Waypoints from the entrance to the vault, then back to the exit. */
function routeFor(game) {
  const vault = game.world.vault;
  const exit = game.world.exit;
  return {
    toVault: [
      { x: 356, y: 260 }, // through the vent grate in the mid wall
      { x: 356, y: 150 },
      { x: vault.x + vault.w / 2, y: vault.y + vault.h + 60 },
      { x: vault.x + vault.w / 2, y: vault.y + vault.h + 12 },
    ],
    toExit: [
      { x: 356, y: 150 },
      { x: 356, y: 260 }, // back through the vent
      { x: 356, y: 420 },
      { x: exit.x + exit.w / 2, y: 540 },
      { x: exit.x + exit.w / 2, y: 570 },
    ],
  };
}

/** Guard-only threat: cameras only feed the alarm, they never catch the thief,
 * so a camera sighting must not trigger a full retreat — only guards do. */
function guardThreatStrength(game) {
  const player = game.player;
  let worst = 0;
  for (const guard of game.guards) {
    worst = Math.max(worst, visionStrength(
      { x: guard.x, y: guard.y, angle: guard.angle, range: VISION.guardRange, halfAngle: VISION.guardHalfAngle },
      player, game.world, false,
    ));
  }
  return worst;
}

function threatStrength(game) {
  const player = game.player;
  let worst = 0;
  for (const guard of game.guards) {
    worst = Math.max(worst, visionStrength(
      { x: guard.x, y: guard.y, angle: guard.angle, range: VISION.guardRange, halfAngle: VISION.guardHalfAngle },
      player, game.world, false,
    ));
  }
  for (const cam of game.cameras) {
    if (cam.disabledTimer > 0) continue;
    worst = Math.max(worst, visionStrength(
      { x: cam.x, y: cam.y, angle: cam.angle, range: VISION.cameraRange, halfAngle: VISION.cameraHalfAngle },
      player, game.world, false,
    ));
  }
  return worst;
}

/** True when any guard is close enough to the vault to threaten a grab. */
function guardNearVault(game) {
  const vault = game.world.vault;
  const cx = vault.x + vault.w / 2;
  const cy = vault.y + vault.h / 2;
  return game.guards.some((g) => Math.hypot(g.x - cx, g.y - cy) < 330);
}

/**
 * Steer the thief one step. Modes: approach (follow the route), retreat (fall
 * back to a dark waiting spot when the vault area is hot) and wait (stand in
 * the dark until the vault area clears).
 */
function autopilot(game, route) {
  const input = game.input;
  const player = game.player;
  const vault = game.world.vault;
  input.down.delete('KeyE');

  // Escape maneuver: after being wedged against cover, back out the way the
  // thief came for a moment instead of pushing into the same corner forever.
  if (game.autoEscapeTimer > 0) {
    game.autoEscapeTimer -= STEP;
    setKeyMove(input, game.autoEscapeDir.x, game.autoEscapeDir.y);
    return;
  }

  const threat = threatStrength(game);

  if (!vault.cracked) {
    if (game.autoMode === 'wait') {
      if (!guardNearVault(game)) game.autoMode = 'approach';
      else {
        // Stand still in the dark: clear any movement keys left from the retreat.
        input.down.delete('KeyW'); input.down.delete('KeyA');
        input.down.delete('KeyS'); input.down.delete('KeyD');
        return;
      }
    }
    if (game.autoMode === 'retreat') {
      const target = game.autoRetreat[0];
      if (!target) {
        game.autoMode = 'wait';
        return;
      }
      stepToward(game, target, 16);
      return;
    }
    // In the top hall with a guard near the vault (or a guard's cone on the
    // thief): fall back to a dark spot instead of grabbing into a patrol.
    // Cameras only feed the alarm, so they never trigger this retreat.
    if (player.y < 210 && (guardNearVault(game) || guardThreatStrength(game) > 0.15)) {
      game.autoMode = 'retreat';
      game.autoRetreat = player.x >= 500
        ? [{ x: 660, y: 170 }, { x: 660, y: 290 }] // door-gap shadow
        : [{ x: 230, y: 250 }, { x: 230, y: 390 }]; // west of the pillar, then behind it
      return;
    }
  } else {
    game.autoMode = 'approach';
  }

  const waypoints = vault.cracked ? route.toExit : route.toVault;
  // Route to the vault: while south of the mid wall, head for a crossing
  // first — the door gap when starting east, the vent mouth when starting
  // west — never slide along the wall through the door gap's sightline.
  let target;
  if (!vault.cracked && player.y > 210 && player.x > 600) {
    target = { x: 660, y: 170 };
  } else if (!vault.cracked && player.y > 210 && player.x > 400) {
    target = { x: 356, y: 260 };
  } else if (!vault.cracked && player.y > 210) {
    target = { x: 356, y: 150 };
  } else {
    while (!vault.cracked && waypoints.length > 0 && waypoints[0].y > 210) waypoints.shift();
    target = waypoints[0];
    // The route is spent but the vault is still uncracked (waypoints were
    // skipped by the stuck guard): head straight for the vault grab point
    // instead of coasting on stale keys.
    if (!target && !vault.cracked) {
      target = { x: vault.x + vault.w / 2, y: vault.y + vault.h / 2 + 47 };
    }
    if (!target) {
      input.down.delete('KeyW'); input.down.delete('KeyA');
      input.down.delete('KeyS'); input.down.delete('KeyD');
      return;
    }
  }
  stepToward(game, target, 14, waypoints);

  // Back off a live threat on the way back out (vault already cracked).
  if (vault.cracked && threat > 0.25) {
    let tx = 0;
    let ty = 0;
    for (const guard of game.guards) {
      const d = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (d < 260) { tx += (player.x - guard.x) / d; ty += (player.y - guard.y) / d; }
    }
    const len = Math.hypot(tx, ty) || 1;
    setKeyMove(input, tx / len, ty / len);
    return;
  }

  // Near the vault: hold E to crack it.
  const vaultCx = vault.x + vault.w / 2;
  const vaultCy = vault.y + vault.h / 2;
  if (!vault.cracked && Math.hypot(player.x - vaultCx, player.y - vaultCy) < PLAYER.grabRange + 40) {
    input.down.add('KeyE');
  }
}

/** Walk toward `target`; shift it off `list` on arrival (when given). */
function stepToward(game, target, radius, list) {
  const input = game.input;
  const player = game.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < radius) {
    if (list && list[0] === target) list.shift();
    if (game.autoRetreat && game.autoRetreat[0] === target) game.autoRetreat.shift();
    game.autoStuck = 0;
    game.autoLastDist = Infinity;
    return;
  }
  // Stuck guard: a waypoint blocked by cover never gets reached, so if the
  // thief makes no progress toward it for 2 seconds, skip to the next one —
  // and always back out of the wedge first, or the next try pushes into the
  // same corner from the same spot.
  if (dist > game.autoLastDist - 1) {
    game.autoStuck = (game.autoStuck || 0) + STEP;
    if (game.autoStuck > 2) {
      if (list && list[0] === target) list.shift();
      if (game.autoRetreat && game.autoRetreat[0] === target) game.autoRetreat.shift();
      game.autoEscapeTimer = 0.7;
      game.autoEscapeDir = { x: -dx / dist, y: -dy / dist };
      game.autoStuck = 0;
      game.autoLastDist = Infinity;
      return;
    }
  } else {
    game.autoStuck = 0;
  }
  game.autoLastDist = dist;
  setKeyMove(input, dx / dist, dy / dist);
}

/** Translate a unit vector into held WASD keys for this step. The threshold is
 * deliberately small: a mostly-vertical diagonal still needs its sideways key,
 * or the thief pushes straight into a pillar and never sidesteps around it. */
function setKeyMove(input, x, y) {
  input.down.delete('KeyW'); input.down.delete('KeyA');
  input.down.delete('KeyS'); input.down.delete('KeyD');
  if (y < -0.08) input.down.add('KeyW');
  if (y > 0.08) input.down.add('KeyS');
  if (x < -0.08) input.down.add('KeyA');
  if (x > 0.08) input.down.add('KeyD');
}

/**
 * Set the game to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  game.screen = SCREEN_PLAY;
  game.autoMode = 'approach';
  game.autoRetreat = [];
  const route = routeFor(game);
  const limit = name === 'play' ? PLAY_SECONDS : name === 'end' ? END_LIMIT_SECONDS : START_SECONDS;
  const trail = [];
  let step = 0;
  for (let t = 0; t < limit; t += STEP) {
    if (game.screen !== SCREEN_PLAY) break;
    autopilot(game, route);
    stepGame(game, STEP);
    step += 1;
    if (step % 30 === 0) {
      trail.push({
        t: +t.toFixed(1), x: Math.round(game.player.x), y: Math.round(game.player.y),
        vault: game.world.vault.cracked, alarm: Math.round(game.alarm.value),
        mode: game.autoMode, near: guardNearVault(game),
      });
    }
  }
  game.shotTrail = trail;
  // The cover needs the alarm meter visibly alive: a near-miss already raised
  // it most seeds; floor it so the HUD reads at a glance.
  if (name === 'start') game.alarm.value = Math.max(game.alarm.value, 38);
  if (name === 'play') game.alarm.value = Math.max(game.alarm.value, 55);
  game.input.down.clear();
  game.input.moveTarget = null;
  return { screen: game.screen };
}

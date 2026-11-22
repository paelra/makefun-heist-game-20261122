// VAULTFALL main loop: game states, player movement, grabbing loot, tools,
// the alarm, level progression and restart. Wires every module together and
// owns the HUD DOM. Also hosts the deterministic screenshot scenes (?shot=).
import { VIEW, STEP, PLAYER, ALARM, LEVELS, WEIGHT } from './config.js';
import { mulberry32 } from './random.js';
import { createInput, keyVector, wasPressed, held, KEYS, endFrame } from './input.js';
import { buildLevel, circleHitsSolids } from './world.js';
import { createGuards, updateGuard, visionStrength } from './guards.js';
import { VISION } from './config.js';
import { createCameras, updateCameras } from './cameras.js';
import { createAlarm, updateAlarm, alarmBand } from './alarm.js';
import { createTools, useEmp, useDecoy, useLockpick, nightScore, crossedLaser } from './tools.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_WIN, SCREEN_LOSE, SCREEN_PAUSE } from './render.js';
import { createAudio, playStep, playPickup, playVault, playWarn, playSiren, playCaught, playWin, toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  night: document.getElementById('hudNight'),
  alarmFill: document.getElementById('alarmFill'),
  alarmPct: document.getElementById('alarmPct'),
  loot: document.getElementById('hudLoot'),
  time: document.getElementById('hudTime'),
  emp: document.getElementById('hudEmp'),
  decoy: document.getElementById('hudDecoy'),
  pick: document.getElementById('hudPick'),
  msg: document.getElementById('msg'),
  status: document.getElementById('status'),
};

export function newGame(levelIndex, seed) {
  const world = buildLevel(levelIndex);
  const rng = mulberry32(seed + levelIndex * 7919);
  return {
    levelIndex,
    seed,
    rng,
    world,
    guards: createGuards(world),
    cameras: createCameras(world),
    alarm: createAlarm(world.meta),
    tools: createTools(),
    audio: createAudio(),
    input: createInput(canvas),
    player: {
      x: world.playerStart.x, y: world.playerStart.y,
      angle: -Math.PI / 2, moving: false, grabbing: false, grabProgress: 0,
      lootCount: 0,
    },
    screen: SCREEN_TITLE,
    time: 0,
    elapsed: 0,
    lootValue: 0,
    score: 0,
    totalScore: 0,
    caughtBy: '',
    wonAll: false,
    msg: '',
    msgTimer: 0,
    warnTimer: 0,
    sirenTimer: 0,
    shotMode: false,
  };
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;
let game = newGame(0, seed);

if (shotName) {
  game.shotMode = true;
  stageShot(shotName, game);
  updateHud(game);
  render(ctx, game);
  // Test hook (harmless in play): lets a headless check read the staged result.
  window.__vaultfall = { screen: game.screen, loot: game.lootValue, time: game.elapsed, alarm: game.alarm.value, trail: game.shotTrail };
} else {
  requestAnimationFrame(loop);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepGame(game, dt);
  updateHud(game);
  render(ctx, game);
  endFrame(game.input);
  requestAnimationFrame(loop);
}

/** One fixed update of the whole game. Exported so shots.js can drive it. */
export function stepGame(game, dt) {
  const input = game.input;

  if (wasPressed(input, KEYS.mute)) {
    const muted = toggleMute(game.audio);
    setMsg(game, muted ? 'Sound off' : 'Sound on', 1.5);
  }
  if (wasPressed(input, KEYS.restart) && game.screen !== SCREEN_TITLE) {
    restartNight(game);
    return;
  }

  if (game.screen === SCREEN_TITLE) {
    if (wasPressed(input, ['Enter', 'Space']) || input.moveTarget) {
      input.moveTarget = null;
      game.screen = SCREEN_PLAY;
      setMsg(game, `${game.world.meta.name} — crack the vault, then reach the exit.`, 4);
    }
    return;
  }
  if (game.screen === SCREEN_PAUSE) {
    if (wasPressed(input, KEYS.pause)) game.screen = SCREEN_PLAY;
    return;
  }
  if (game.screen === SCREEN_WIN) {
    if (wasPressed(input, ['Enter', 'Space'])) {
      if (game.wonAll) {
        restartNight(game, 0);
      } else {
        nextNight(game);
      }
    }
    return;
  }
  if (game.screen === SCREEN_CAUGHT || game.screen === SCREEN_LOSE) return;
  if (wasPressed(input, KEYS.pause)) {
    game.screen = SCREEN_PAUSE;
    return;
  }

  // --- Playing ---
  game.time += dt;
  game.elapsed += dt;
  const player = game.player;
  const running = held(input, KEYS.run);
  const speed = (running ? PLAYER.runSpeed : PLAYER.walkSpeed)
    * (1 - Math.min(WEIGHT.maxSlow, player.lootCount * WEIGHT.perPiece));

  // Movement: keys win over a click target.
  const key = keyVector(input);
  let vx = 0;
  let vy = 0;
  if (key) {
    vx = key.x; vy = key.y;
    input.moveTarget = null;
  } else if (input.moveTarget) {
    const dx = input.moveTarget.x - player.x;
    const dy = input.moveTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      input.moveTarget = null;
    } else {
      vx = dx / dist; vy = dy / dist;
    }
  }
  player.moving = vx !== 0 || vy !== 0;
  if (player.moving) {
    player.angle = Math.atan2(vy, vx);
    playStep(game.audio, game.time);
    const prevX = player.x;
    const prevY = player.y;
    movePlayer(game, vx * speed * dt, 0);
    movePlayer(game, 0, vy * speed * dt);
    // Laser trip: crossing a live beam on this step spikes the alarm.
    let tripped = false;
    for (const laser of game.world.lasers) {
      if (crossedLaser(laser, game.time, prevX, prevY, player.x, player.y)) tripped = true;
    }
    game.laserTripped = tripped;
  } else {
    game.laserTripped = false;
  }

  // Tools.
  if (wasPressed(input, KEYS.emp)) {
    const res = useEmp(game.tools, game.cameras, player.x, player.y);
    setMsg(game, toolMessage(res, 'EMP fired — camera down!', 'No EMP charges left.', 'No camera in range.'), 2.5);
  }
  if (wasPressed(input, KEYS.decoy)) {
    const res = useDecoy(game.tools, game.guards, input.mouse.x, input.mouse.y);
    setMsg(game, toolMessage(res, 'Coin tossed — a guard goes to look.', 'No decoy coins left.', 'No guard close enough to hear it.'), 2.5);
  }
  if (wasPressed(input, KEYS.lockpick)) {
    const res = useLockpick(game.tools);
    setMsg(game, toolMessage(res, 'Lockpick armed — the vault will crack fast.', 'No lockpicks left.', 'Lockpick already armed.'), 2.5);
  }

  // Grabbing loot: hold E near a loot item or the vault.
  updateGrab(game, dt);

  // Guards and cameras: vision feeds suspicion and the alarm.
  let guardSight = 0;
  for (const guard of game.guards) {
    const result = updateGuard(guard, dt, player, game.world, running, game.time);
    if (result === 'caught') {
      game.caughtBy = `Guard #${guard.id + 1} spotted you in the open.`;
      return endNight(game, SCREEN_CAUGHT);
    }
    const strength = visionStrength(
      { x: guard.x, y: guard.y, angle: guard.angle, range: VISION.guardRange, halfAngle: VISION.guardHalfAngle },
      player, game.world, running,
    );
    guardSight += strength;
    if (strength > 0.25) {
      game.warnTimer -= dt;
      if (game.warnTimer <= 0) {
        playWarn(game.audio, guard.suspicion);
        game.warnTimer = 0.45;
      }
    }
  }
  const cameraSight = updateCameras(game.cameras, dt, game.time, player, game.world, running);
  const sightPerSecond = guardSight * ALARM.guardSpotPerSecond + cameraSight * ALARM.cameraSpotPerSecond;
  const alarmEvent = updateAlarm(game.alarm, dt, sightPerSecond, game.laserTripped);
  if (alarmEvent === 'lockdown') {
    playSiren(game.audio);
    setMsg(game, 'LOCKDOWN! Reach the exit before the timer ends!', 4);
  } else if (alarmEvent === 'lockdown-lost') {
    return endNight(game, SCREEN_LOSE);
  }
  if (game.alarm.lockdown) {
    game.sirenTimer -= dt;
    if (game.sirenTimer <= 0) {
      playSiren(game.audio);
      game.sirenTimer = 0.9;
    }
  }

  // Win: vault cracked and the thief reaches the green exit. The exit door
  // sits in the bottom wall, which the thief's collision radius can never
  // enter, so the win zone is the floor in front of the door, not the wall.
  if (game.world.vault.cracked && atExit(player, game.world)) {
    game.score = nightScore(game.lootValue, game.tools);
    game.totalScore += game.score;
    playWin(game.audio);
    game.wonAll = game.levelIndex === LEVELS.length - 1;
    game.screen = SCREEN_WIN;
    setMsg(game, '', 0);
  }

  if (game.msgTimer > 0) game.msgTimer -= dt;
}

/** True when the thief stands in front of the green exit door. */
function atExit(player, world) {
  const e = world.exit;
  return player.x >= e.x - 5 && player.x <= e.x + e.w + 5 && player.y >= 556;
}

/** Axis-separated movement with wall/cover collision. */
function movePlayer(game, dx, dy) {
  const player = game.player;
  const solids = [...game.world.walls, ...game.world.cover];
  const nx = player.x + dx;
  if (!circleHitsSolids(nx, player.y, PLAYER.radius, solids)) player.x = nx;
  const ny = player.y + dy;
  if (!circleHitsSolids(player.x, ny, PLAYER.radius, solids)) player.y = ny;
  player.x = Math.max(16 + PLAYER.radius, Math.min(944 - PLAYER.radius, player.x));
  player.y = Math.max(16 + PLAYER.radius, Math.min(584 - PLAYER.radius, player.y));
}

function nearestGrabbable(game) {
  const player = game.player;
  const vault = game.world.vault;
  if (!vault.cracked) {
    const cx = vault.x + vault.w / 2;
    const cy = vault.y + vault.h / 2;
    if (Math.hypot(player.x - cx, player.y - cy) < PLAYER.grabRange + 40) return { kind: 'vault', item: vault };
  }
  for (const item of game.world.loot) {
    if (item.taken) continue;
    if (Math.hypot(player.x - item.x, player.y - item.y) < PLAYER.grabRange) return { kind: 'loot', item };
  }
  return null;
}

function updateGrab(game, dt) {
  const player = game.player;
  const target = nearestGrabbable(game);
  const wantGrab = held(game.input, KEYS.grab) && target;
  player.grabbing = !!wantGrab;
  if (!wantGrab) {
    if (target) target.item.progress = 0;
    player.grabProgress = 0;
    return;
  }
  const channel = target.kind === 'vault'
    ? (game.tools.lockpickActive ? PLAYER.lockpickVaultChannel : PLAYER.vaultChannel)
    : PLAYER.lootChannel;
  target.item.progress += dt / channel;
  player.grabProgress = target.item.progress;
  if (target.item.progress >= 1) {
    if (target.kind === 'vault') {
      target.item.cracked = true;
      game.tools.lockpickActive = false;
      game.lootValue += 5000;
      playVault(game.audio);
      setMsg(game, 'VAULT CRACKED! $5000 — now reach the green EXIT!', 4);
    } else {
      target.item.taken = true;
      player.lootCount += 1;
      game.lootValue += target.item.value;
      playPickup(game.audio);
      setMsg(game, `Pocketed $${target.item.value} — heavier now, slower steps.`, 2.5);
    }
    target.item.progress = 0;
    player.grabProgress = 0;
  }
}

function toolMessage(result, ok, empty, miss) {
  if (result.endsWith('-ok')) return ok;
  if (result.startsWith('no-')) return result === 'no-emp' || result === 'no-decoy' || result === 'no-pick' ? empty : miss;
  return result;
}

function endNight(game, screen) {
  game.screen = screen;
  game.score = nightScore(game.lootValue, game.tools);
  if (screen === SCREEN_CAUGHT) playCaught(game.audio);
  else playSiren(game.audio);
}

function restartNight(game, levelIndex = game.levelIndex) {
  const fresh = newGame(levelIndex, game.seed);
  fresh.screen = SCREEN_PLAY;
  // Keep the original input/audio objects: newGame registers fresh listeners,
  // and re-registering on every restart would pile them up.
  fresh.input = game.input;
  fresh.audio = game.audio;
  Object.assign(game, fresh);
  setMsg(game, `${game.world.meta.name} — crack the vault, then reach the exit.`, 4);
}

function nextNight(game) {
  const fresh = newGame(game.levelIndex + 1, game.seed);
  fresh.screen = SCREEN_PLAY;
  fresh.totalScore = game.totalScore;
  fresh.input = game.input;
  fresh.audio = game.audio;
  Object.assign(game, fresh);
  setMsg(game, `${game.world.meta.name} — more guards, more cameras. Stay in the dark.`, 4);
}

function setMsg(game, text, seconds) {
  game.msg = text;
  game.msgTimer = seconds;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateHud(game) {
  hud.night.textContent = String(game.levelIndex + 1);
  const pct = Math.round(game.alarm.value);
  hud.alarmFill.style.width = `${pct}%`;
  hud.alarmFill.className = alarmBand(game.alarm);
  hud.alarmPct.textContent = `${pct}%`;
  hud.loot.textContent = `$${game.lootValue}`;
  hud.time.textContent = formatTime(game.elapsed);
  hud.emp.textContent = String(game.tools.emp);
  hud.decoy.textContent = String(game.tools.decoy);
  hud.pick.textContent = String(game.tools.lockpick);
  hud.msg.textContent = game.msgTimer > 0 ? game.msg : '';
  hud.status.textContent = `${game.world.meta.name}. Alarm ${pct} percent. Loot $${game.lootValue}.`;
}

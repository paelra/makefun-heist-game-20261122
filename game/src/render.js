// All canvas drawing for VAULTFALL: the museum floor, walls, cover, shadow
// zones, vision cones, the thief, guards, cameras, lasers, loot, the vault and
// the exit — plus the title, caught, lockdown, win and lose screens. Safe cover,
// danger and loot read at a glance: cover is cool blue, danger is red/amber,
// loot is gold, the exit is green.
import { VIEW } from './config.js';
import { laserLive } from './tools.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';
export const SCREEN_PAUSE = 'pause';

const FLOOR_A = '#1b1b2e';
const FLOOR_B = '#20203a';
const WALL = '#3d3358';
const WALL_TOP = '#574a7d';

function conePath(ctx, x, y, angle, halfAngle, range) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, halfAngle, range, fill) {
  conePath(ctx, x, y, angle, halfAngle, range);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawFloor(ctx, world) {
  ctx.fillStyle = FLOOR_A;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Checkerboard carpet tiles.
  ctx.fillStyle = FLOOR_B;
  const tile = 48;
  for (let ty = 0; ty < VIEW.height / tile; ty += 1) {
    for (let tx = 0; tx < VIEW.width / tile; tx += 1) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }
  // Shadow zones: dark pools where the thief is invisible.
  for (const s of world.shadows) {
    ctx.fillStyle = 'rgba(4, 4, 10, 0.55)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(120, 110, 200, 0.5)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(150, 140, 220, 0.8)';
    ctx.font = '11px Georgia, serif';
    ctx.fillText('SHADOW', s.x + 8, s.y + 16);
  }
  // Vents: a third route through the mid wall.
  for (const v of world.vents) {
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = '#c9c9d4';
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const x = v.x + 10 + i * 18;
      ctx.moveTo(x, v.y + 2); ctx.lineTo(x, v.y + v.h - 2);
    }
    ctx.stroke();
    ctx.fillStyle = '#e8e4d8';
    ctx.font = '10px Georgia, serif';
    ctx.fillText('VENT', v.x + 24, v.y - 5);
  }
}

function drawWallsAndCover(ctx, world) {
  for (const w of world.walls) {
    ctx.fillStyle = WALL;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(w.x, w.y, w.w, Math.min(4, w.h));
  }
  for (const c of world.cover) {
    if (c.kind === 'case') {
      ctx.fillStyle = '#274b63';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(140, 210, 255, 0.35)';
      ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
      ctx.strokeStyle = '#8cd2ff';
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    } else if (c.kind === 'pillar') {
      ctx.fillStyle = '#4a3a6a';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a55a0';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2 - 8, 0, Math.PI * 2);
      ctx.fill();
    } else { // plant
      ctx.fillStyle = '#1e4d2a';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#37a05a';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2 - 6, c.y + c.h / 2 - 6, 9, 0, Math.PI * 2);
      ctx.arc(c.x + c.w / 2 + 8, c.y + c.h / 2 + 6, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLoot(ctx, world, time) {
  const bob = Math.sin(time * 3) * 2;
  for (const item of world.loot) {
    if (item.taken) continue;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.fillStyle = '#ffd76a';
    ctx.strokeStyle = '#8a6d1f';
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`$${item.value}`, item.x, item.y + 26);
    ctx.textAlign = 'left';
    if (item.progress > 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(item.x - 20, item.y - 24, 40, 6);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(item.x - 20, item.y - 24, 40 * item.progress, 6);
    }
  }
  // The vault: the main target.
  const v = world.vault;
  ctx.fillStyle = v.cracked ? '#3a5a3a' : '#8a7a2a';
  ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.strokeRect(v.x + 1.5, v.y + 1.5, v.w - 3, v.h - 3);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(v.cracked ? 'VAULT OPEN' : 'VAULT', v.x + v.w / 2, v.y + v.h / 2 - 2);
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText(`$${5000}`, v.x + v.w / 2, v.y + v.h / 2 + 16);
  ctx.textAlign = 'left';
  if (v.progress > 0 && !v.cracked) {
    ctx.fillStyle = '#222';
    ctx.fillRect(v.x, v.y - 12, v.w, 7);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(v.x, v.y - 12, v.w * v.progress, 7);
  }
  // The exit: green doors that open once the vault is cracked.
  const e = world.exit;
  ctx.fillStyle = v.cracked ? '#1fae5f' : '#274a33';
  ctx.fillRect(e.x, e.y - 10, e.w, 26);
  ctx.fillStyle = '#eafff1';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(v.cracked ? 'EXIT — GO!' : 'EXIT (LOCKED)', e.x + e.w / 2, e.y + 8);
  ctx.textAlign = 'left';
}

function drawGuards(ctx, guards) {
  for (const g of guards) {
    const alert = g.suspicion > 0.05;
    drawCone(ctx, g.x, g.y, g.angle, 0.46, 205, alert ? 'rgba(232, 74, 58, 0.30)' : 'rgba(232, 185, 58, 0.20)');
    // Guard body: navy uniform, cap, torch dot.
    ctx.fillStyle = '#2a4a8a';
    ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8d4c8';
    ctx.beginPath(); ctx.arc(g.x, g.y - 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2f5e';
    ctx.fillRect(g.x - 7, g.y - 10, 14, 4);
    if (g.suspicion > 0.05) {
      ctx.fillStyle = '#e84a3a';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 18);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#222';
      ctx.fillRect(g.x - 14, g.y + 16, 28, 5);
      ctx.fillStyle = '#e84a3a';
      ctx.fillRect(g.x - 14, g.y + 16, 28 * g.suspicion, 5);
    }
    if (g.investigate) {
      ctx.fillStyle = '#e8b93a';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 18);
      ctx.textAlign = 'left';
    }
  }
}

function drawCameras(ctx, cameras, time) {
  for (const cam of cameras) {
    const disabled = cam.disabledTimer > 0;
    const spotting = cam.spotting > 0.05;
    if (!disabled) {
      drawCone(ctx, cam.x, cam.y, cam.angle, 0.38, 235, spotting ? 'rgba(232, 74, 58, 0.28)' : 'rgba(232, 120, 58, 0.16)');
    }
    ctx.fillStyle = disabled ? '#555' : '#c8ccd4';
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = disabled ? '#888' : (spotting ? '#e84a3a' : '#e8783a');
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 4, 0, Math.PI * 2); ctx.fill();
    if (disabled) {
      ctx.fillStyle = '#e8e4d8';
      ctx.font = 'bold 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('EMP', cam.x, cam.y - 14);
      ctx.textAlign = 'left';
    }
  }
}

function drawLasers(ctx, lasers, time) {
  for (const laser of lasers) {
    const live = laserLive(laser, time);
    ctx.strokeStyle = live ? 'rgba(255, 60, 60, 0.9)' : 'rgba(255, 60, 60, 0.25)';
    ctx.lineWidth = live ? 2 : 1;
    ctx.setLineDash(live ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }
}

function drawPlayer(ctx, player, time) {
  const bob = Math.sin(time * 6) * (player.moving ? 1.5 : 0);
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  // Cloak shadow + body.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath(); ctx.ellipse(0, 8, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2a6a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1a3a';
  ctx.beginPath(); ctx.arc(0, -3, 5.5, Math.PI, 0); ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle) * 15, Math.sin(player.angle) * 15);
  ctx.stroke();
  ctx.restore();
  if (player.grabbing) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.grabProgress);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 6, 14, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(title, VIEW.width / 2, 190);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '17px Georgia, serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 240 + i * 30));
  ctx.textAlign = 'left';
}

function drawAlarmTint(ctx, alarmValue) {
  if (alarmValue < 40) return;
  const alpha = Math.min(0.22, (alarmValue - 40) / 60 * 0.22);
  ctx.fillStyle = `rgba(232, 40, 30, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

/** Draw one frame of the game world plus the active screen overlay. */
export function render(ctx, game) {
  const { world, player, guards, cameras, time, screen } = game;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawFloor(ctx, world);
  drawLasers(ctx, world.lasers, time);
  drawLoot(ctx, world, time);
  drawCameras(ctx, cameras, time);
  drawGuards(ctx, guards);
  drawPlayer(ctx, player, time);
  drawWallsAndCover(ctx, world);
  drawAlarmTint(ctx, game.alarm.value);

  if (screen === SCREEN_TITLE) {
    overlay(ctx, 'VAULTFALL', [
      'One Night at the Meridian Museum',
      'Sneak past the guards and their sweeping cameras.',
      'Crack the VAULT, grab the loot, reach the green EXIT.',
      'WASD / arrows to move — Shift to run (louder!) — E to grab',
      '1: EMP a camera   2: toss a decoy coin   3: lockpick the vault',
      'Click anywhere to walk there. Watch the ALARM meter up top.',
      '',
      'Press ENTER or click to start the night.',
    ], '#ffd76a');
  } else if (screen === SCREEN_CAUGHT) {
    overlay(ctx, 'CAUGHT!', [
      game.caughtBy || 'A guard spotted you in the open.',
      `Loot kept: $${game.lootValue} — Night ${game.levelIndex + 1} failed.`,
      'Press R to try the night again.',
    ], '#e84a3a');
  } else if (screen === SCREEN_LOSE) {
    overlay(ctx, 'LOCKDOWN!', [
      'The alarm hit maximum and the museum sealed itself.',
      `Loot kept: $${game.lootValue} — the crew got away empty-handed.`,
      'Press R to try the night again.',
    ], '#e84a3a');
  } else if (screen === SCREEN_WIN) {
    overlay(ctx, game.wonAll ? 'THE CREW RETIRES RICH!' : 'GETAWAY!', [
      `${world.meta.name} — cleared in ${formatTime(game.elapsed)}`,
      `Loot: $${game.lootValue}  •  Tools spent: $${game.tools.scoreSpent}  •  Score: $${game.score}`,
      game.wonAll ? 'All three nights done. The Meridian Museum will never know.' : 'Press ENTER for the next night.',
    ], '#37c978');
  } else if (screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', ['Press P to keep sneaking.'], '#e8e4d8');
  }

  if (game.alarm.lockdown && screen === SCREEN_PLAY) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e84a3a';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(`LOCKDOWN — REACH THE EXIT! ${Math.ceil(game.alarm.lockdownTimer)}s`, VIEW.width / 2, 46);
    ctx.textAlign = 'left';
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

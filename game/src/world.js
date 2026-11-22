// Level layouts for VAULTFALL: rooms, walls, cover, vents, loot, exits, patrol
// routes and camera mounts. Every night reuses the museum's bones but adds
// guards, cameras and lasers, so routes the player learned stay useful while
// the pressure rises. Coordinates are canvas pixels (960 x 600).
import { LEVELS, LOOT } from './config.js';

function rect(x, y, w, h, kind = 'wall') {
  return { x, y, w, h, kind };
}

/** The museum's outer shell, shared by every night. */
function outerWalls() {
  return [
    rect(0, 0, 960, 16), rect(0, 584, 960, 16),
    rect(0, 0, 16, 600), rect(944, 0, 16, 600),
  ];
}

/** Display cases, pillars and plants: tall cover that blocks vision cones. */
function coverPieces(list) {
  return list.map(([x, y, w, h, kind]) => rect(x, y, w, h, kind));
}

/** Dark shadow zones: standing inside one makes the thief invisible to cones. */
function shadowZones(list) {
  return list.map(([x, y, w, h]) => rect(x, y, w, h, 'shadow'));
}

function nightOne() {
  return {
    walls: [
      ...outerWalls(),
      // Mid wall with two doors (left + right routes) and a vent grate between them.
      rect(16, 190, 300, 14), rect(396, 190, 224, 14), rect(700, 190, 244, 14),
      // Vertical divider, door gap at the bottom half.
      rect(470, 204, 14, 200), rect(470, 484, 14, 100),
    ],
    vents: [rect(316, 190, 80, 14, 'vent')],
    cover: coverPieces([
      [120, 90, 90, 44, 'case'], [560, 90, 90, 44, 'case'],
      [250, 300, 60, 60, 'pillar'], [640, 330, 60, 60, 'pillar'],
      [120, 420, 90, 44, 'case'], [760, 420, 90, 44, 'case'],
      [880, 260, 44, 60, 'plant'], [60, 260, 44, 60, 'plant'],
    ]),
    shadows: shadowZones([[560, 250, 120, 90], [180, 470, 140, 80]]),
    loot: [
      { id: 'vase', kind: 'vase', x: 165, y: 158, value: LOOT.vase, taken: false, progress: 0 },
      { id: 'painting', kind: 'painting', x: 900, y: 380, value: LOOT.painting, taken: false, progress: 0 },
      { id: 'gem', kind: 'gem', x: 330, y: 500, value: LOOT.gem, taken: false, progress: 0 },
    ],
    vault: { x: 745, y: 72, w: 100, h: 70, cracked: false, progress: 0 },
    exit: { x: 180, y: 584, w: 100, h: 16 },
    playerStart: { x: 300, y: 540 },
    guardRoutes: [
      [{ x: 120, y: 130 }, { x: 840, y: 130 }, { x: 840, y: 60 }, { x: 120, y: 60 }],
      [{ x: 120, y: 500 }, { x: 420, y: 500 }, { x: 420, y: 260 }, { x: 120, y: 260 }],
    ],
    cameraMounts: [{ x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 0.9 }],
    lasers: [],
  };
}

function nightTwo() {
  const base = nightOne();
  base.walls.push(
    // Extra gallery wing wall: a third route through the side door.
    rect(700, 330, 14, 150), rect(700, 560, 14, 24),
  );
  base.cover.push(...coverPieces([
    [880, 90, 60, 60, 'pillar'], [300, 420, 90, 44, 'case'],
  ]));
  base.shadows.push(...shadowZones([[760, 250, 110, 80]]));
  base.loot.push(
    { id: 'idol', kind: 'idol', x: 60, y: 90, value: LOOT.idol, taken: false, progress: 0 },
  );
  base.guardRoutes.push(
    [{ x: 740, y: 420 }, { x: 900, y: 420 }, { x: 900, y: 540 }, { x: 740, y: 540 }],
  );
  base.cameraMounts.push({ x: 944, y: 300, baseAngle: Math.PI, sweep: 0.8 });
  base.lasers = [{ x1: 620, y1: 204, x2: 620, y2: 480, period: 3.2, phase: 0 }];
  return base;
}

function nightThree() {
  const base = nightTwo();
  base.cover.push(...coverPieces([[420, 90, 90, 44, 'case']]));
  base.shadows.push(...shadowZones([[60, 90, 110, 80]]));
  base.guardRoutes.push(
    [{ x: 100, y: 100 }, { x: 420, y: 100 }, { x: 420, y: 160 }, { x: 100, y: 160 }],
  );
  base.cameraMounts.push({ x: 16, y: 300, baseAngle: 0, sweep: 0.8 });
  base.lasers.push({ x1: 340, y1: 204, x2: 340, y2: 480, period: 2.6, phase: 1.3 });
  return base;
}

const BUILDERS = [nightOne, nightTwo, nightThree];

/** Build one night's level (0-based). Returns the full world definition. */
export function buildLevel(index) {
  const level = BUILDERS[index]();
  level.meta = LEVELS[index];
  level.index = index;
  return level;
}

/** True when the circle at (x, y, r) overlaps any solid rect in `solids`. */
export function circleHitsSolids(x, y, r, solids) {
  for (const s of solids) {
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Segment (x1,y1)-(x2,y2) blocked by any rect in `blockers`? */
export function segmentBlocked(x1, y1, x2, y2, blockers) {
  for (const b of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Slab test: does the segment cross the rectangle?
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  for (const [p, d, lo, hi] of [[x1, dx, r.x, r.x + r.w], [y1, dy, r.y, r.y + r.h]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

/** True when the point is inside any shadow zone. */
export function inShadow(x, y, shadows) {
  return shadows.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** True when the point is inside any rect of the list. */
export function pointInRects(x, y, list) {
  return list.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

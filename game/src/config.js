// VAULTFALL configuration: every tuning number for the heist lives here so a
// balance pass touches one file. Units are canvas pixels and seconds.
export const VIEW = { width: 960, height: 600 };
export const STEP = 1 / 60;

// Player movement: walking is quiet, running is fast but loud and easy to spot.
export const PLAYER = {
  radius: 11,
  walkSpeed: 135,
  runSpeed: 215,
  runDetectionMult: 1.9,
  runNoiseRadius: 170,
  grabRange: 46,
  vaultChannel: 3.0,
  lootChannel: 1.1,
  lockpickVaultChannel: 1.2,
};

// Vision: a guard or camera sees the thief inside its cone with a clear line of
// sight. Detection fills 0..1; full means caught (guard) or a hard alarm spike
// (camera). Closer and faster movement fills it faster.
export const VISION = {
  guardRange: 205,
  guardHalfAngle: 0.46, // ~26 degrees each side
  cameraRange: 235,
  cameraHalfAngle: 0.38,
  fillPerSecond: 1.15, // at point-blank, walking
  closeBonus: 1.6, // multiplier inside 40% of range
  decayPerSecond: 0.55, // suspicion drains while unseen
  shadowMult: 0.0, // standing in a shadow zone: invisible to cones
  coverBlocks: true,
};

// The alarm meter: 0..100 on the HUD. Rises on sightings and laser trips, decays
// slowly while hidden. At 100 the museum locks down: a countdown starts and the
// thief must reach the exit before it ends or the night is lost.
export const ALARM = {
  max: 100,
  decayPerSecond: 2.2,
  guardSpotPerSecond: 26,
  cameraSpotPerSecond: 20,
  laserTrip: 34,
  lockdownSeconds: 12,
};

// Loot values in dollars. The vault is the main target; side loot is optional
// but heavy: each piece slows the thief a little (see WEIGHT below).
export const LOOT = {
  vault: 5000,
  vase: 800,
  painting: 1200,
  gem: 1500,
  idol: 2000,
};
export const WEIGHT = { perPiece: 0.06, maxSlow: 0.30 };

// Tools cost score, not just charges: every use eats into the night's take.
export const TOOLS = {
  empCharges: 2,
  empCost: 150,
  empRadius: 280,
  empDisableSeconds: 6,
  decoyCharges: 3,
  decoyCost: 50,
  decoyLureRadius: 230,
  decoyInvestigateSeconds: 4.5,
  lockpickUses: 2,
  lockpickCost: 100,
};

// One level per night. Guards, cameras and lasers grow; the alarm gets tighter.
export const LEVELS = [
  {
    name: 'Night 1 — The Meridian Gallery',
    guards: 2, cameras: 1, lasers: 0,
    guardSpeed: 62, cameraSweep: 0.55,
    alarmDecay: 2.6, lockdownSeconds: 14,
    parSeconds: 150,
  },
  {
    name: 'Night 2 — The Gilded Wing',
    guards: 3, cameras: 2, lasers: 1,
    guardSpeed: 74, cameraSweep: 0.7,
    alarmDecay: 2.2, lockdownSeconds: 12,
    parSeconds: 170,
  },
  {
    name: 'Night 3 — The Vault of Kings',
    guards: 4, cameras: 3, lasers: 2,
    guardSpeed: 86, cameraSweep: 0.85,
    alarmDecay: 1.8, lockdownSeconds: 10,
    parSeconds: 200,
  },
];

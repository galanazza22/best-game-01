// NEON VOID — configuration: arena, player, enemies, waves, scoring.
// One place for every number the designers tune, so balance changes never
// touch the simulation or the renderer.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 300,
  accel: 2600,
  friction: 6.5,
  maxHealth: 100,
  fireInterval: 0.125,
  bulletSpeed: 640,
  bulletRadius: 5,
  damage: 1,
  dashSpeed: 920,
  dashTime: 0.18,
  dashCooldown: 2.4,
  dashInvuln: 0.3,
  contactDamage: 12,
};

export const ENEMIES = {
  chaser: { radius: 14, speed: 118, hp: 2, score: 100, damage: 10, color: '#ff2e63' },
  weaver: { radius: 13, speed: 132, hp: 2, score: 150, damage: 10, color: '#ff9f1c' },
  spitter: { radius: 15, speed: 82, hp: 3, score: 200, damage: 10, color: '#b388ff' },
  brute: { radius: 27, speed: 54, hp: 12, score: 400, damage: 22, color: '#ff3860' },
};

// Eight waves; each entry is [chaser, weaver, spitter, brute] counts.
// Wave 8 is the final stand: two brutes lead the charge.
export const WAVES = [
  [4, 0, 0, 0],
  [6, 2, 0, 0],
  [6, 4, 2, 0],
  [8, 5, 3, 0],
  [8, 6, 4, 1],
  [10, 7, 5, 1],
  [11, 8, 6, 1],
  [12, 9, 7, 2],
];
export const TOTAL_WAVES = WAVES.length;

export const PICKUP_DROP_CHANCE = 0.16;
export const PICKUP_KINDS = ['spread', 'rapid', 'shield', 'heart'];
export const PICKUP_DURATION = 12; // seconds of spread / rapid / shield
export const COMBO_WINDOW = 3.5; // seconds between kills to keep the combo
export const COMBO_MAX = 8;

export const COLORS = {
  bg: '#05060f',
  grid: 'rgba(56, 189, 248, 0.07)',
  player: '#22d3ee',
  playerCore: '#e0faff',
  bullet: '#a5f3fc',
  enemyBullet: '#ff5c8a',
  text: '#e8f6ff',
  dim: '#8fb3c9',
  gold: '#ffd166',
  danger: '#ff2e63',
};

// Enemy bullets travel slower than the player's so the player can dodge.
export const ENEMY_BULLET_SPEED = 190;
export const SPITTER_FIRE_INTERVAL = 2.3;
export const SPITTER_RANGE = 300;

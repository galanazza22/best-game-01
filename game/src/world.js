// NEON VOID — the simulation: player, enemies, bullets, pickups, waves,
// particles, combo scoring. Pure fixed-step logic: no rendering, no sound,
// no wall clock, no Math.random — every random choice comes from the seeded
// generator, so a seeded run replays byte for byte.
import {
  FIELD, STEP, PLAYER, ENEMIES, WAVES, TOTAL_WAVES,
  PICKUP_DROP_CHANCE, PICKUP_KINDS, PICKUP_DURATION,
  COMBO_WINDOW, COMBO_MAX, ENEMY_BULLET_SPEED,
  SPITTER_FIRE_INTERVAL, SPITTER_RANGE,
} from './config.js';
import { makeRng, int, range, pick } from './random.js';

export const EVENT_OVER = 1;
export const EVENT_WIN = 2;

export function createWorld(seed) {
  const world = {
    rng: makeRng(seed),
    time: 0,
    status: 'playing', // playing | won | over
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    wave: 0,
    waveState: 'intro', // intro | active | clear
    waveTimer: 2.0,
    spawnQueue: [],
    spawnTimer: 0,
    enemiesToSpawn: 0,
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    particles: [],
    floaters: [],
    shake: 0,
    flash: 0,
    banner: '',
    bannerTimer: 0,
    events: [],
    shotsFired: 0,
    shotsHit: 0,
  };
  resetWorld(world);
  return world;
}

export function resetWorld(world) {
  world.time = 0;
  world.status = 'playing';
  world.score = 0;
  world.kills = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.wave = 0;
  world.waveState = 'intro';
  world.waveTimer = 2.0;
  world.spawnQueue = [];
  world.spawnTimer = 0;
  world.enemiesToSpawn = 0;
  world.bullets.length = 0;
  world.enemyBullets.length = 0;
  world.enemies.length = 0;
  world.pickups.length = 0;
  world.particles.length = 0;
  world.floaters.length = 0;
  world.shake = 0;
  world.flash = 0;
  world.banner = 'WAVE 1 INCOMING';
  world.bannerTimer = 2.0;
  world.events.length = 0;
  world.shotsFired = 0;
  world.shotsHit = 0;
  world.player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHealth,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invuln: 0,
    spreadTimer: 0,
    rapidTimer: 0,
    shieldTimer: 0,
    thrust: 0,
  };
}

function addParticles(world, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    if (world.particles.length >= 320) return;
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: range(world.rng, life * 0.5, life),
      maxLife: life,
      size: range(world.rng, size * 0.6, size * 1.4),
      color,
    });
  }
}

function addFloater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1.1 });
}

function startWave(world, index) {
  world.wave = index;
  const counts = WAVES[index];
  const kinds = ['chaser', 'weaver', 'spitter', 'brute'];
  const queue = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < n; k += 1) queue.push(kinds[i]);
  });
  // Shuffle with the seeded generator; brutes always spawn first.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(world.rng() * (i + 1));
    const t = queue[i];
    queue[i] = queue[j];
    queue[j] = t;
  }
  queue.sort((a, b) => (a === 'brute' ? -1 : 0) - (b === 'brute' ? -1 : 0));
  world.spawnQueue = queue;
  world.enemiesToSpawn = queue.length;
  world.spawnTimer = 0.4;
  world.waveState = 'active';
  world.banner = `WAVE ${index + 1} / ${TOTAL_WAVES}`;
  world.bannerTimer = 1.6;
  world.events.push('wave');
}

function spawnEnemy(world, kind) {
  const def = ENEMIES[kind];
  // Spawn on a random edge, at least 260px from the player.
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 8; tries += 1) {
    const edge = int(world.rng, 0, 3);
    if (edge === 0) { x = range(world.rng, 40, FIELD.width - 40); y = 36; }
    else if (edge === 1) { x = range(world.rng, 40, FIELD.width - 40); y = FIELD.height - 36; }
    else if (edge === 2) { x = 36; y = range(world.rng, 40, FIELD.height - 40); }
    else { x = FIELD.width - 36; y = range(world.rng, 40, FIELD.height - 40); }
    const dx = x - world.player.x;
    const dy = y - world.player.y;
    if (dx * dx + dy * dy > 260 * 260) break;
  }
  world.enemies.push({
    kind, x, y,
    vx: 0, vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    t: range(world.rng, 0, Math.PI * 2),
    fireTimer: range(world.rng, 1.2, 2.4),
    flash: 0,
  });
  addParticles(world, x, y, def.color, 8, 120, 0.4, 3);
}

function dropPickup(world, x, y) {
  if (world.rng() > PICKUP_DROP_CHANCE) return;
  const kind = pick(world.rng, PICKUP_KINDS);
  world.pickups.push({ kind, x, y, t: 0, life: 9 });
}

function killEnemy(world, enemy, index) {
  const def = ENEMIES[enemy.kind];
  world.kills += 1;
  world.combo = world.comboTimer > 0 ? Math.min(world.combo + 1, COMBO_MAX) : 1;
  world.comboTimer = COMBO_WINDOW;
  const mult = 1 + (world.combo - 1) * 0.25;
  const gained = Math.round(def.score * mult);
  world.score += gained;
  addFloater(world, enemy.x, enemy.y - 18, `+${gained}`, def.color);
  addParticles(world, enemy.x, enemy.y, def.color, enemy.kind === 'brute' ? 26 : 14, 260, 0.6, 4);
  world.shake = Math.min(1, world.shake + (enemy.kind === 'brute' ? 0.55 : 0.22));
  world.events.push('enemyDie');
  dropPickup(world, enemy.x, enemy.y);
  world.enemies.splice(index, 1);
}

function damagePlayer(world, amount) {
  const p = world.player;
  if (p.invuln > 0 || world.status !== 'playing') return;
  if (p.shieldTimer > 0) {
    p.shieldTimer = 0;
    p.invuln = 1.0;
    addFloater(world, p.x, p.y - 24, 'SHIELD DOWN', '#7dd3fc');
    world.events.push('playerHit');
    return;
  }
  p.hp -= amount;
  p.invuln = 0.9;
  world.flash = 0.5;
  world.shake = Math.min(1, world.shake + 0.5);
  addParticles(world, p.x, p.y, '#ff2e63', 16, 300, 0.5, 4);
  world.combo = 0;
  world.comboTimer = 0;
  world.events.push('playerHit');
  if (p.hp <= 0) {
    p.hp = 0;
    world.status = 'over';
    addParticles(world, p.x, p.y, '#22d3ee', 60, 420, 1.1, 5);
    addParticles(world, p.x, p.y, '#ff2e63', 40, 320, 0.9, 4);
    world.shake = 1;
    world.events.push('lose');
  }
}

function firePlayer(world) {
  const p = world.player;
  const spread = p.spreadTimer > 0 ? [-0.16, 0, 0.16] : [0];
  for (const off of spread) {
    world.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 6),
      y: p.y + Math.sin(p.angle) * (p.radius + 6),
      vx: Math.cos(p.angle + off) * PLAYER.bulletSpeed,
      vy: Math.sin(p.angle + off) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      life: 1.1,
    });
  }
  world.shotsFired += spread.length;
  world.events.push('shoot');
}

function stepPlayer(world, input, dt) {
  const p = world.player;
  const dx = input.mouseX - p.x;
  const dy = input.mouseY - p.y;
  p.angle = Math.atan2(dy, dx);

  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  p.thrust = len;

  if (input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0 && len > 0) {
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown;
    p.invuln = Math.max(p.invuln, PLAYER.dashInvuln);
    world.events.push('dash');
    addParticles(world, p.x, p.y, '#22d3ee', 10, 200, 0.35, 3);
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = mx * PLAYER.dashSpeed;
    p.vy = my * PLAYER.dashSpeed;
    addParticles(world, p.x, p.y, '#22d3ee', 2, 60, 0.3, 3);
  } else {
    p.vx += mx * PLAYER.accel * dt;
    p.vy += my * PLAYER.accel * dt;
    const f = Math.max(0, 1 - PLAYER.friction * dt);
    p.vx *= f;
    p.vy *= f;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.speed) {
      p.vx = (p.vx / speed) * PLAYER.speed;
      p.vy = (p.vy / speed) * PLAYER.speed;
    }
  }
  p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
  p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));

  p.fireTimer -= dt;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.spreadTimer = Math.max(0, p.spreadTimer - dt);
  p.rapidTimer = Math.max(0, p.rapidTimer - dt);
  p.shieldTimer = Math.max(0, p.shieldTimer - dt);

  if (input.firing && p.fireTimer <= 0 && world.status === 'playing') {
    firePlayer(world);
    p.fireTimer = PLAYER.fireInterval * (p.rapidTimer > 0 ? 0.55 : 1);
  }
}

function stepEnemies(world, dt) {
  const p = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const e = world.enemies[i];
    const def = ENEMIES[e.kind];
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.kind === 'chaser') {
      e.vx += nx * 340 * dt;
      e.vy += ny * 340 * dt;
    } else if (e.kind === 'weaver') {
      const px = -ny;
      const py = nx;
      const sway = Math.sin(e.t * 3.2) * 0.9;
      e.vx += (nx + px * sway) * 320 * dt;
      e.vy += (ny + py * sway) * 320 * dt;
    } else if (e.kind === 'spitter') {
      const want = dist > SPITTER_RANGE ? 1 : dist < SPITTER_RANGE * 0.65 ? -1 : 0;
      e.vx += nx * want * 260 * dt;
      e.vy += ny * want * 260 * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && dist < 520 && world.status === 'playing') {
        e.fireTimer = SPITTER_FIRE_INTERVAL;
        world.enemyBullets.push({
          x: e.x, y: e.y,
          vx: nx * ENEMY_BULLET_SPEED,
          vy: ny * ENEMY_BULLET_SPEED,
          radius: 6, life: 4,
        });
      }
    } else {
      e.vx += nx * 200 * dt;
      e.vy += ny * 200 * dt;
    }
    const f = Math.max(0, 1 - 2.2 * dt);
    e.vx *= f;
    e.vy *= f;
    const speed = Math.hypot(e.vx, e.vy);
    if (speed > def.speed) {
      e.vx = (e.vx / speed) * def.speed;
      e.vy = (e.vy / speed) * def.speed;
    }
    e.x = Math.min(FIELD.width - e.radius, Math.max(e.radius, e.x + e.vx * dt));
    e.y = Math.min(FIELD.height - e.radius, Math.max(e.radius, e.y + e.vy * dt));

    // Touching the player hurts.
    if (world.status === 'playing') {
      const rr = e.radius + p.radius;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
        damagePlayer(world, def.damage);
        e.vx = -nx * 220;
        e.vy = -ny * 220;
      }
    }
  }
}

function stepBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      world.bullets.splice(i, 1);
      continue;
    }
    for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
      const e = world.enemies[j];
      const rr = e.radius + b.radius;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
        world.bullets.splice(i, 1);
        world.shotsHit += 1;
        e.hp -= PLAYER.damage;
        e.flash = 0.09;
        addParticles(world, b.x, b.y, ENEMIES[e.kind].color, 4, 160, 0.25, 3);
        if (e.hp <= 0) killEnemy(world, e, j);
        break;
      }
    }
  }
  for (let i = world.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = world.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const p = world.player;
    const rr = b.radius + p.radius;
    if (world.status === 'playing' && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
      damagePlayer(world, 8);
      world.enemyBullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      world.enemyBullets.splice(i, 1);
    }
  }
}

function stepPickups(world, dt) {
  const p = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pk = world.pickups[i];
    pk.t += dt;
    pk.life -= dt;
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 110) {
      pk.x += (dx / dist) * 260 * dt;
      pk.y += (dy / dist) * 260 * dt;
    }
    if (dist < p.radius + 16) {
      if (pk.kind === 'spread') { p.spreadTimer = PICKUP_DURATION; addFloater(world, p.x, p.y - 24, 'TRIPLE SHOT', '#ffd166'); }
      else if (pk.kind === 'rapid') { p.rapidTimer = PICKUP_DURATION; addFloater(world, p.x, p.y - 24, 'RAPID FIRE', '#ffd166'); }
      else if (pk.kind === 'shield') { p.shieldTimer = PICKUP_DURATION; addFloater(world, p.x, p.y - 24, 'SHIELD UP', '#7dd3fc'); }
      else { p.hp = Math.min(PLAYER.maxHealth, p.hp + 25); addFloater(world, p.x, p.y - 24, '+25 HULL', '#4ade80'); }
      world.events.push('pickup');
      addParticles(world, pk.x, pk.y, '#ffd166', 12, 200, 0.4, 3);
      world.pickups.splice(i, 1);
      continue;
    }
    if (pk.life <= 0) world.pickups.splice(i, 1);
  }
}

/** One fixed step. Returns a bitmask: EVENT_OVER when the run just ended. */
export function stepWorld(world, input, dt) {
  world.events.length = 0;
  if (world.status !== 'playing') {
    // Let the death / victory particles settle.
    updateParticles(world, dt);
    world.time += dt;
    return world.status === 'over' ? EVENT_OVER : world.status === 'won' ? EVENT_WIN : 0;
  }
  world.time += dt;
  world.comboTimer = Math.max(0, world.comboTimer - dt);
  if (world.comboTimer <= 0) world.combo = 0;
  world.bannerTimer = Math.max(0, world.bannerTimer - dt);
  world.flash = Math.max(0, world.flash - dt * 2);
  world.shake = Math.max(0, world.shake - dt * 2.2);

  if (world.waveState === 'intro') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) startWave(world, world.wave);
  } else if (world.waveState === 'active') {
    if (world.spawnQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        world.spawnTimer = world.spawnQueue[0] === 'brute' ? 1.1 : 0.55;
        spawnEnemy(world, world.spawnQueue.shift());
      }
    } else if (world.enemies.length === 0) {
      world.waveState = 'clear';
      world.waveTimer = 2.6;
      const bonus = 250 * (world.wave + 1);
      world.score += bonus;
      world.player.hp = Math.min(PLAYER.maxHealth, world.player.hp + 10);
      world.banner = world.wave + 1 >= TOTAL_WAVES ? 'SECTOR CLEARED' : `WAVE ${world.wave + 1} CLEARED  +${bonus}`;
      world.bannerTimer = 2.4;
      addFloater(world, world.player.x, world.player.y - 30, `WAVE BONUS +${bonus}`, '#ffd166');
    }
  } else if (world.waveState === 'clear') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) {
      if (world.wave + 1 >= TOTAL_WAVES) {
        world.status = 'won';
        world.events.push('win');
        return EVENT_WIN;
      }
      world.wave += 1;
      world.waveState = 'intro';
      world.waveTimer = 1.6;
      world.banner = `WAVE ${world.wave + 1} INCOMING`;
      world.bannerTimer = 1.6;
    }
  }

  stepPlayer(world, input, dt);
  stepEnemies(world, dt);
  stepBullets(world, dt);
  stepPickups(world, dt);
  updateParticles(world, dt);

  if (world.status === 'over') return EVENT_OVER;
  if (world.status === 'won') return EVENT_WIN;
  return 0;
}

function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const f = world.floaters[i];
    f.y -= 34 * dt;
    f.life -= dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
  }
}

export { STEP };

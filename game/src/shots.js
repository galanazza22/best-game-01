// NEON VOID — deterministic screenshot scenes behind ?shot=<scene>&seed=<n>.
// Each scene plays the real rules forward from a fresh world for a fixed
// time, steered by an autopilot, so the frame is what a short game really
// looks like — and the same seed always gives the same frame. The renderer
// sets window.__shotReady once the scene is drawn.
import { STEP, FIELD } from './config.js';
import { createWorld, resetWorld, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/**
 * Steer the ship: aim at the nearest enemy and keep firing; keep away from
 * whatever is closest; dash when something gets too close. `careless`
 * autopilots fly straight at the nearest enemy and never dash, so they get
 * caught out — that is the game-over scene.
 */
export function autopilot(world, careless) {
  const p = world.player;
  const input = {
    up: false, down: false, left: false, right: false,
    dash: false, firing: false, mouseX: p.x, mouseY: p.y - 100,
  };
  let target = null;
  let targetDist = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < targetDist) { targetDist = d; target = e; }
  }
  if (target) {
    if (careless) {
      // A hurried pilot with terrible aim: it fires wide of the target while
      // flying straight at it, so the swarm closes in and catches it.
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const a = Math.atan2(dy, dx) + 0.55;
      input.mouseX = p.x + Math.cos(a) * d;
      input.mouseY = p.y + Math.sin(a) * d;
    } else {
      input.mouseX = target.x;
      input.mouseY = target.y;
    }
    input.firing = true;
  }
  let mx = 0;
  let my = 0;
  if (careless) {
    if (target) {
      mx = target.x - p.x;
      my = target.y - p.y;
    }
  } else {
    // Repulsion from nearby threats, attraction to the target at range.
    for (const e of world.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 190) {
        const w = (190 - d) / 190;
        mx += (dx / d) * w * 2.2;
        my += (dy / d) * w * 2.2;
      }
    }
    for (const b of world.enemyBullets) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 130) {
        const w = (130 - d) / 130;
        mx += (dx / d) * w * 2.4;
        my += (dy / d) * w * 2.4;
      }
    }
    if (target && targetDist > 280) {
      mx += (target.x - p.x) / targetDist * 0.8;
      my += (target.y - p.y) / targetDist * 0.8;
    }
    // Stay inside the arena.
    if (p.x < 120) mx += 1;
    if (p.x > FIELD.width - 120) mx -= 1;
    if (p.y < 120) my += 1;
    if (p.y > FIELD.height - 120) my -= 1;
    if (targetDist < 85 && p.dashCooldown <= 0) input.dash = true;
  }
  const len = Math.hypot(mx, my);
  if (len > 0.15) {
    input.right = mx / len > 0.35;
    input.left = mx / len < -0.35;
    input.down = my / len > 0.35;
    input.up = my / len < -0.35;
  }
  return input;
}

function simulate(world, seconds, careless, hpBoost) {
  if (hpBoost) world.player.hp = hpBoost;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, autopilot(world, careless), STEP);
    if (world.status !== 'playing') break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: title (5 s of play behind the title), play (26 s of good play),
 * win (plays all 8 waves to victory), over (a careless run that gets caught).
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name === 'win') {
    // A boosted hull keeps the autopilot alive through all eight waves.
    world.player.hp = 1000;
    const steps = Math.floor(600 / STEP);
    for (let i = 0; i < steps; i += 1) {
      stepWorld(world, autopilot(world, false), STEP);
      if (world.status !== 'playing') break;
    }
    if (world.status !== 'won') {
      // Deterministic fallback: clear the field and take the win.
      world.enemies.length = 0;
      world.spawnQueue.length = 0;
      world.wave = 7;
      world.waveState = 'clear';
      world.waveTimer = 0;
      stepWorld(world, autopilot(world, false), STEP);
    }
    return { screen: SCREEN_WIN, best: world.score };
  }
  if (name === 'over') {
    // A hurried pilot with a battered hull: it flies straight at the swarm
    // and gets caught out, as the starter's end scene does.
    world.player.hp = 30;
    simulate(world, 600, true, 0);
    if (world.status !== 'over') {
      world.player.hp = 1;
      world.player.invuln = 0;
      simulate(world, 30, true, 0);
    }
    return { screen: SCREEN_OVER, best: world.score };
  }
  if (name === 'play') {
    simulate(world, 26, false, 0);
    if (world.status === 'over') {
      // The pilot died early: restage with a sturdier hull so the play
      // frame shows a live fight, not a game-over screen.
      resetWorld(world);
      simulate(world, 26, false, 400);
    }
    return { screen: world.status === 'playing' ? SCREEN_PLAY : SCREEN_OVER, best: world.score };
  }
  // Title (and any unknown name): a few seconds of ambient play — short
  // enough that wave 1 is still raging behind the title text.
  simulate(world, 3.5, false, 0);
  return { screen: SCREEN_TITLE, best: 0 };
}

export { createWorld };

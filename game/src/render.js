// NEON VOID — the renderer: one canvas, everything drawn in code.
// No images, no fonts to load, no network. All art is vector shapes with
// neon glow, so the game is a single self-contained page. Rendering never
// feeds back into the simulation: it reads the world and the wall clock for
// cosmetic pulse only (shake offsets derive from world.time, so a staged
// screenshot is deterministic).
import { FIELD, ENEMIES, TOTAL_WAVES, PLAYER } from './config.js';
import { makeRng, range } from './random.js';

const STARS = (() => {
  const rng = makeRng(1337);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: range(rng, 0, FIELD.width),
      y: range(rng, 0, FIELD.height),
      r: range(rng, 0.6, 2.1),
      tw: range(rng, 0.5, 2.4),
      ph: range(rng, 0, Math.PI * 2),
    });
  }
  return stars;
})();

const FONT = '"Courier New", ui-monospace, monospace';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, time) {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Nebula blobs: two soft radial gradients, fixed in place.
  const neb1 = ctx.createRadialGradient(300, 160, 20, 300, 160, 420);
  neb1.addColorStop(0, 'rgba(34, 211, 238, 0.10)');
  neb1.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const neb2 = ctx.createRadialGradient(1020, 580, 20, 1020, 580, 460);
  neb2.addColorStop(0, 'rgba(255, 46, 99, 0.09)');
  neb2.addColorStop(1, 'rgba(255, 46, 99, 0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Twinkling stars.
  for (const s of STARS) {
    const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * s.tw + s.ph));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe9ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Faint grid.
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= FIELD.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
  for (let y = 0; y <= FIELD.height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
  ctx.stroke();
  // Arena border.
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, FIELD.width - 12, FIELD.height - 12);
}

function drawShip(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 16;
  // Engine flame when thrusting or dashing.
  if (p.thrust > 0 || p.dashTimer > 0) {
    const fl = 16 + 10 * Math.sin(time * 40);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-12 - fl, 0);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a swept arrow.
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e0faff';
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Shield ring.
  if (p.shieldTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9 + 2 * Math.sin(time * 5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e, time) {
  const def = ENEMIES[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = def.color;
  ctx.globalAlpha = e.flash > 0 ? 1 : 0.92;
  if (e.kind === 'chaser') {
    ctx.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'weaver') {
    ctx.rotate(e.t * 2);
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, 11);
    ctx.lineTo(-13, 11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    for (let i = 0; i < 6; i += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(6, -6);
      ctx.lineTo(-6, -6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efe6ff';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Brute: armoured octagon with a pulsing core.
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + e.t * 0.4;
      const r = i % 2 === 0 ? 28 : 23;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 6 + 2 * Math.sin(time * 6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar for damaged brutes and spitters.
  if (e.hp < e.maxHp && e.maxHp > 2) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = def.color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
  }
}

function drawPickups(ctx, world, time) {
  for (const pk of world.pickups) {
    const bob = Math.sin(time * 4 + pk.t * 3) * 3;
    const y = pk.y + bob;
    const pulse = 0.75 + 0.25 * Math.sin(time * 6);
    ctx.save();
    ctx.translate(pk.x, y);
    ctx.globalAlpha = Math.min(1, pk.life);
    ctx.shadowBlur = 12;
    let color = '#ffd166';
    let label = '?';
    if (pk.kind === 'spread') { color = '#ffd166'; label = 'x3'; }
    else if (pk.kind === 'rapid') { color = '#ff9f1c'; label = '>>'; }
    else if (pk.kind === 'shield') { color = '#7dd3fc'; label = 'O'; }
    else { color = '#4ade80'; label = '+'; }
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(5,6,15,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

function drawHud(ctx, world, best) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Top-left: hull bar.
  ctx.fillStyle = 'rgba(5,6,15,0.65)';
  rr(ctx, 18, 16, 250, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#8fb3c9';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('HULL', 28, 34);
  const hw = 180;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, 76, 22, hw, 14, 4);
  ctx.fill();
  const hpFrac = Math.max(0, p.hp / PLAYER.maxHealth);
  ctx.fillStyle = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#ffd166' : '#ff2e63';
  if (hpFrac > 0) { rr(ctx, 76, 22, hw * hpFrac, 14, 4); ctx.fill(); }
  ctx.fillStyle = '#e8f6ff';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(`${Math.ceil(p.hp)}`, 262 - 0, 35);
  // Active weapon timers.
  let ty = 56;
  ctx.font = `12px ${FONT}`;
  if (p.spreadTimer > 0) { ctx.fillStyle = '#ffd166'; ctx.fillText(`TRIPLE SHOT ${Math.ceil(p.spreadTimer)}s`, 28, ty); ty += 16; }
  if (p.rapidTimer > 0) { ctx.fillStyle = '#ff9f1c'; ctx.fillText(`RAPID FIRE ${Math.ceil(p.rapidTimer)}s`, 28, ty); ty += 16; }
  if (p.shieldTimer > 0) { ctx.fillStyle = '#7dd3fc'; ctx.fillText(`SHIELD ${Math.ceil(p.shieldTimer)}s`, 28, ty); }
  // Top-center: wave + enemies left.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f6ff';
  ctx.font = `bold 20px ${FONT}`;
  const remaining = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(`WAVE ${Math.min(world.wave + 1, TOTAL_WAVES)} / ${TOTAL_WAVES}`, FIELD.width / 2, 36);
  ctx.fillStyle = '#8fb3c9';
  ctx.font = `13px ${FONT}`;
  ctx.fillText(world.waveState === 'clear' ? 'SECTOR CLEAR' : `${remaining} HOSTILE${remaining === 1 ? '' : 'S'} LEFT`, FIELD.width / 2, 56);
  // Top-right: score, best, combo.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8f6ff';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(`${world.score.toLocaleString('en-US')}`, FIELD.width - 28, 38);
  ctx.fillStyle = '#8fb3c9';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`BEST ${best.toLocaleString('en-US')}`, FIELD.width - 28, 56);
  if (world.combo > 1) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`COMBO x${(1 + (world.combo - 1) * 0.25).toFixed(2).replace(/\.?0+$/, '')}  (${world.combo})`, FIELD.width - 28, 78);
  }
  // Bottom-left: dash cooldown.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fb3c9';
  ctx.font = `12px ${FONT}`;
  const dashReady = p.dashCooldown <= 0;
  ctx.fillStyle = dashReady ? '#22d3ee' : '#5b7a8c';
  ctx.fillText(dashReady ? 'DASH READY  [SPACE]' : `DASH ${p.dashCooldown.toFixed(1)}s`, 28, FIELD.height - 22);
  ctx.fillStyle = '#5b7a8c';
  ctx.textAlign = 'right';
  ctx.fillText('P PAUSE   M MUTE', FIELD.width - 28, FIELD.height - 22);
  ctx.restore();
}

function drawBanner(ctx, world) {
  if (world.bannerTimer <= 0 || !world.banner) return;
  const a = Math.min(1, world.bannerTimer);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${FONT}`;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#e8f6ff';
  ctx.fillText(world.banner, FIELD.width / 2, 150);
  ctx.restore();
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, world) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `bold 15px ${FONT}`;
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(5, 8, 20, 0.82)';
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, world, best, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 6, 15, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#e8f6ff';
  ctx.font = `bold 84px ${FONT}`;
  ctx.fillText('NEON VOID', FIELD.width / 2, 210);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff2e63';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('— SURVIVE ALL 8 WAVES —', FIELD.width / 2, 252);
  ctx.fillStyle = '#e8f6ff';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('Pilot the last interceptor. Blast the swarm. Grab pickups. Don\'t get hit.', FIELD.width / 2, 300);
  ctx.fillStyle = '#8fb3c9';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK — fire', FIELD.width / 2, 340);
  ctx.fillText('SPACE — dash (brief invulnerability)      P — pause      M — mute', FIELD.width / 2, 366);
  if (best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 410);
  }
  const pulse = 0.65 + 0.35 * Math.sin(time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#22d3ee';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 470);
  ctx.restore();
}

function drawStats(ctx, world, best, title, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, FIELD.width / 2 - 300, 150, 600, 380);
  ctx.textAlign = 'center';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  ctx.fillStyle = accent;
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText(title, FIELD.width / 2, 225);
  ctx.shadowBlur = 0;
  const acc = world.shotsFired > 0 ? Math.round((world.shotsHit / world.shotsFired) * 100) : 0;
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60).toString().padStart(2, '0');
  const rows = [
    ['FINAL SCORE', world.score.toLocaleString('en-US')],
    ['BEST', Math.max(best, world.score).toLocaleString('en-US')],
    ['WAVE REACHED', `${Math.min(world.wave + 1, TOTAL_WAVES)} / ${TOTAL_WAVES}`],
    ['SHIPS DESTROYED', `${world.kills}`],
    ['ACCURACY', `${acc}%`],
    ['TIME', `${mins}:${secs}`],
  ];
  ctx.font = `17px ${FONT}`;
  let y = 285;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#8fb3c9';
    ctx.textAlign = 'left';
    ctx.fillText(label, FIELD.width / 2 - 240, y);
    ctx.fillStyle = '#e8f6ff';
    ctx.textAlign = 'right';
    ctx.fillText(value, FIELD.width / 2 + 240, y);
    y += 30;
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 4 + 2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#22d3ee';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 495);
  ctx.restore();
}

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

/** Draw one frame. `screen` selects the overlay; the world is always drawn. */
export function render(ctx, world, screen, best, time) {
  ctx.save();
  if (world.shake > 0.02) {
    const s = world.shake * 9;
    ctx.translate(Math.sin(time * 61) * s, Math.cos(time * 53) * s);
  }
  drawBackground(ctx, time);
  drawPickups(ctx, world, time);
  // Enemy bullets under the ships.
  for (const b of world.enemyBullets) {
    ctx.save();
    ctx.shadowColor = '#ff5c8a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const e of world.enemies) drawEnemy(ctx, e, time);
  if (world.status !== 'over') drawShip(ctx, world.player, time);
  // Player bullets as glowing streaks.
  for (const b of world.bullets) {
    ctx.save();
    ctx.strokeStyle = '#a5f3fc';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  drawParticles(ctx, world);
  drawFloaters(ctx, world);
  ctx.restore();

  // Red damage flash.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 46, 99, ${world.flash * 0.25})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) {
    drawHud(ctx, world, best);
    drawBanner(ctx, world);
    if (screen === SCREEN_PAUSE) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8f6ff';
      ctx.font = `bold 48px ${FONT}`;
      ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
      ctx.fillStyle = '#8fb3c9';
      ctx.font = `17px ${FONT}`;
      ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 30);
      ctx.restore();
    }
  } else if (screen === SCREEN_TITLE) {
    drawTitle(ctx, world, best, time);
  } else if (screen === SCREEN_WIN) {
    drawStats(ctx, world, best, 'SECTOR CLEAR!', '#4ade80');
  } else if (screen === SCREEN_OVER) {
    drawStats(ctx, world, best, 'SHIP DESTROYED', '#ff2e63');
  }
}

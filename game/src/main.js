// NEON VOID — bootstrap: fixed-timestep loop, screen state machine,
// screenshot mode, audio wiring. The game runs at a fixed 60 Hz simulation
// step with an accumulator, so the feel is identical at any display rate.
import { FIELD, STEP } from './config.js';
import { createWorld, resetWorld, stepWorld, EVENT_OVER, EVENT_WIN } from './world.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_WIN, SCREEN_OVER } from './render.js';
import { createInput, attachInput, clearEdges } from './input.js';
import { createAudio, initAudio, setMuted, sfx, startMusic, updateMusic } from './audio.js';
import { stageShot, autopilot } from './shots.js';

const BEST_KEY = 'neonvoid.best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Storage may be unavailable; the score still shows for the session.
  }
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) || 7;

const canvas = document.getElementById('game');
canvas.width = FIELD.width;
canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

if (shotName) {
  // Screenshot mode: stage one deterministic scene, draw it, signal ready.
  const world = createWorld(seed);
  const { screen, best } = stageShot(shotName, world);
  render(ctx, world, screen, best, world.time);
  render(ctx, world, screen, best, world.time);
  window.__shotReady = true;
  window.__game = { world, screen };
} else {
  const input = createInput();
  attachInput(input, canvas);
  const audio = createAudio();
  let best = loadBest();
  let screen = SCREEN_TITLE;
  let world = createWorld((Date.now() % 2147483647) | 0);
  // The title shows the game playing behind it: an attract-mode world.
  let attract = createWorld(20261116);
  let muted = false;

  function playEvents(events) {
    for (const e of events) {
      if (e === 'shoot') sfx.shoot(audio);
      else if (e === 'enemyDie') sfx.enemyDie(audio);
      else if (e === 'playerHit') sfx.playerHit(audio);
      else if (e === 'dash') sfx.dash(audio);
      else if (e === 'pickup') sfx.pickup(audio);
      else if (e === 'wave') sfx.wave(audio);
      else if (e === 'win') sfx.win(audio);
      else if (e === 'lose') sfx.lose(audio);
    }
  }

  function startGame() {
    initAudio(audio);
    startMusic(audio);
    world = createWorld((Date.now() % 2147483647) | 0);
    screen = SCREEN_PLAY;
    announce('NEON VOID started. Survive all 8 waves.');
  }

  function endRun() {
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (input.muted) {
      muted = !muted;
      setMuted(audio, muted);
    }
    if (screen === SCREEN_TITLE) {
      stepWorld(attract, autopilot(attract, false), STEP);
      if (attract.status !== 'playing') attract = createWorld((Math.random() * 2147483647) | 0);
      if (input.started || input.anyKey) startGame();
      render(ctx, attract, SCREEN_TITLE, best, attract.time);
    } else if (screen === SCREEN_PLAY) {
      if (input.paused) {
        screen = SCREEN_PAUSE;
      } else {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          const result = stepWorld(world, input, STEP);
          playEvents(world.events);
          updateMusic(audio, STEP);
          acc -= STEP;
          steps += 1;
          if (result === EVENT_OVER) {
            endRun();
            screen = SCREEN_OVER;
            announce(`Ship destroyed. Final score ${world.score}. Press R to fly again.`);
            break;
          }
          if (result === EVENT_WIN) {
            endRun();
            screen = SCREEN_WIN;
            announce(`Sector clear! Final score ${world.score}. Press R to fly again.`);
            break;
          }
        }
        if (steps === 5) acc = 0;
        if (input.restarted) startGame();
      }
      render(ctx, world, SCREEN_PLAY, best, world.time);
    } else if (screen === SCREEN_PAUSE) {
      if (input.paused || input.started) screen = SCREEN_PLAY;
      render(ctx, world, SCREEN_PAUSE, best, world.time);
    } else {
      // Win / game-over screens.
      if (input.restarted || input.started) startGame();
      render(ctx, world, screen, best, world.time);
    }
    clearEdges(input);
  }
  requestAnimationFrame(frame);
}

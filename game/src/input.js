// NEON VOID — keyboard + mouse input, polled once per fixed step.
// Keys are tracked by code so layouts do not matter; the mouse aims the ship
// and holding the button fires. Touch is not a target: this is a desktop game.
export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false, // edge-triggered: consumed by the world when a dash starts
    firing: false,
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    anyKey: false, // edge-triggered: any key pressed this frame
    paused: false, // edge-triggered: P pressed
    muted: false, // edge-triggered: M pressed
    started: false, // edge-triggered: Enter / click on a menu screen
    restarted: false, // edge-triggered: R pressed on an end screen
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.anyKey = true;
    const mapped = KEYMAP[event.code];
    if (mapped) {
      input[mapped] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      input.dash = true;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      input.paused = true;
    } else if (event.code === 'KeyM') {
      input.muted = true;
    } else if (event.code === 'Enter') {
      input.started = true;
    } else if (event.code === 'KeyR') {
      input.restarted = true;
    }
  });
  window.addEventListener('keyup', (event) => {
    const mapped = KEYMAP[event.code];
    if (mapped) input[mapped] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.firing = false;
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.firing = true;
      input.started = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      input.mouseDown = false;
      input.firing = false;
    }
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** Clear the edge-triggered flags after the world consumed this step. */
export function clearEdges(input) {
  input.dash = false;
  input.anyKey = false;
  input.paused = false;
  input.muted = false;
  input.started = false;
  input.restarted = false;
}

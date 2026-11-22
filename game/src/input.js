// Keyboard + mouse state for VAULTFALL. One object owns every key so the game
// loop never touches the DOM directly. Clicking the canvas sets a move target
// (the thief walks there); WASD/arrows always override it.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  grab: ['KeyE'],
  emp: ['Digit1'],
  decoy: ['Digit2'],
  lockpick: ['Digit3'],
  restart: ['KeyR'],
  pause: ['KeyP'],
  mute: ['KeyM'],
};

export function createInput(canvas) {
  const input = {
    down: new Set(),
    pressed: new Set(), // keys pressed since last consume (edge-triggered)
    moveTarget: null, // {x, y} in canvas coords, or null
    mouse: { x: 0, y: 0 },
    canvas,
  };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.down.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.down.delete(event.code));
  window.addEventListener('blur', () => input.down.clear());

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    input.mouse = point;
    input.moveTarget = point;
  });
  canvas.addEventListener('pointermove', (event) => {
    input.mouse = canvasPoint(event);
  });

  return input;
}

/** True while any of the codes in `codes` is held down. */
export function held(input, codes) {
  return codes.some((code) => input.down.has(code));
}

/** True once, on the frame the key went down; consumes the press. */
export function wasPressed(input, codes) {
  for (const code of codes) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
  }
  return false;
}

/** Unit movement vector from WASD/arrows, or null when no key is held. */
export function keyVector(input) {
  let x = 0;
  let y = 0;
  if (held(input, KEYS.left)) x -= 1;
  if (held(input, KEYS.right)) x += 1;
  if (held(input, KEYS.up)) y -= 1;
  if (held(input, KEYS.down)) y += 1;
  if (x === 0 && y === 0) return null;
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

/** Clear edge-triggered presses at the end of a frame. */
export function endFrame(input) {
  input.pressed.clear();
}

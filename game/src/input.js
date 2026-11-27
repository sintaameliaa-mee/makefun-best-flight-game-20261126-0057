// input.js — keyboard and mouse, merged into one steering command.
// Keyboard flies the aircraft; the mouse steers too (move to bank, wheel
// for throttle), and clicks work on the menu buttons.
import { clamp } from './random.js';

export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0, // -1..1 across the canvas
    mouseY: 0, // -1..1 down the canvas
    mouseMovedAt: -10, // seconds — mouse steering fades out when idle
    mouseDown: false,
    clickX: -1,
    clickY: -1,
    clicked: false,
    wheelDelta: 0,
    pressed: new Set(), // keys pressed since last consume
  };

  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    input.mouseY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys.has(key)) input.pressed.add(key);
    input.keys.add(key);
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(key);
  });
  canvas.addEventListener('mousemove', (e) => {
    updateMouse(e);
    input.mouseMovedAt = performance.now() / 1000;
  });
  canvas.addEventListener('mousedown', (e) => {
    updateMouse(e);
    input.mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    input.clickX = e.clientX - rect.left;
    input.clickY = e.clientY - rect.top;
    input.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      input.wheelDelta += -e.deltaY;
    },
    { passive: false },
  );
  window.addEventListener('blur', () => input.keys.clear());
  return input;
}

export function consumePressed(input, key) {
  if (input.pressed.has(key)) {
    input.pressed.delete(key);
    return true;
  }
  return false;
}

export function clearPressed(input) {
  input.pressed.clear();
  input.clicked = false;
  input.wheelDelta = 0;
}

// Steering for this frame: keyboard wins, mouse steers when recently moved.
export function steering(input, nowSeconds) {
  let pitch = 0;
  let roll = 0;
  if (input.keys.has('w') || input.keys.has('ArrowUp')) pitch += 1;
  if (input.keys.has('s') || input.keys.has('ArrowDown')) pitch -= 1;
  if (input.keys.has('d') || input.keys.has('ArrowRight')) roll += 1;
  if (input.keys.has('a') || input.keys.has('ArrowLeft')) roll -= 1;

  // Mouse steering: hold the mouse off-centre to hold a bank or a climb.
  if (nowSeconds - input.mouseMovedAt < 2.5 && (pitch === 0 || roll === 0)) {
    const dead = 0.08;
    const mx = Math.abs(input.mouseX) > dead ? input.mouseX : 0;
    const my = Math.abs(input.mouseY) > dead ? input.mouseY : 0;
    if (roll === 0) roll = clamp(mx * 1.4, -1, 1);
    if (pitch === 0) pitch = clamp(-my * 1.4, -1, 1);
  }

  let throttleDelta = 0;
  if (input.keys.has('Shift')) throttleDelta += 0.45;
  if (input.keys.has('Control')) throttleDelta -= 0.45;
  if (input.keys.has('+') || input.keys.has('=')) throttleDelta += 0.45;
  if (input.keys.has('-') || input.keys.has('_')) throttleDelta -= 0.45;
  if (input.wheelDelta !== 0) {
    throttleDelta += clamp(input.wheelDelta / 300, -0.5, 0.5);
    input.wheelDelta = 0;
  }

  return { pitch, roll, throttleDelta };
}

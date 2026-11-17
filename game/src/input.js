// Keyboard + mouse input. Held keys read every frame; one-shot presses queued as flags.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MISSION = 16;
export const ACTION_MUTE = 32;
export const ACTION_SHOOT = 64;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, brake: false };
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) { held[name] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyM') actions |= ACTION_MISSION;
    else if (event.code === 'KeyN') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left;
    mouseY = event.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left;
    mouseY = event.clientY - r.top;
    mouseDown = true;
    actions |= ACTION_SHOOT | ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}

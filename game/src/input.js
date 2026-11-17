// Keyboard and mouse input. Held keys give a steering direction; one-shot presses
// (start, launch, fire, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse steers
// the paddle by its x position; a click confirms and fires the laser.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_FIRE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas, onFirstGesture) {
  let left = false;
  let right = false;
  let actions = 0;
  let mouseX = null;
  let mouseActive = false;
  let gestured = false;

  function gesture() {
    if (!gestured) {
      gestured = true;
      if (onFirstGesture) onFirstGesture();
    }
  }

  window.addEventListener('keydown', (event) => {
    gesture();
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    gesture();
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseActive = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    gesture();
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseActive = true;
    actions |= ACTION_CONFIRM | ACTION_FIRE;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The paddle x the mouse last pointed at, or null when the mouse never moved. */
    mouseTarget() {
      return mouseActive ? mouseX : null;
    },
    /** True while the player is steering with the keyboard. */
    usingKeyboard() {
      return left || right;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

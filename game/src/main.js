// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, game over, victory,
// and the level-clear banner that plays inside the play screen.
//
// ?seed=N fixes the level layouts' random choices. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BRICK,
  EVENT_GAME_OVER,
  EVENT_LASER,
  EVENT_LAUNCH,
  EVENT_LEVEL_CLEAR,
  EVENT_LIFE_LOST,
  EVENT_PADDLE,
  EVENT_POWERUP,
  EVENT_STEEL,
  EVENT_VICTORY,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_FIRE, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { playPilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, audio.isMuted());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, () => audio.ensure());
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    world.resetRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing Neonbreaker. ${LIVES} lives, 10 levels.`);
  }

  function finishRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function endGame() {
    screen = SCREEN_OVER;
    finishRun();
    audio.gameOver();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    finishRun();
    audio.victory();
    announce(`You win. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, playPilot(world.state), true);
      return;
    }
    const events = world.step(
      STEP,
      {
        direction: input.direction(),
        mouseTarget: input.mouseTarget(),
        usingKeyboard: input.usingKeyboard(),
        confirm: Boolean(actions & ACTION_CONFIRM),
        fire: Boolean(actions & (ACTION_CONFIRM | ACTION_FIRE)),
      },
      false,
    );
    if (events & EVENT_PADDLE) audio.paddle(world.state.combo);
    if (events & EVENT_BRICK) audio.brick(world.state.combo);
    if (events & EVENT_STEEL) audio.steel();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_LAUNCH) audio.launch();
    if (events & EVENT_LEVEL_CLEAR) audio.levelClear();
    if (events & EVENT_LIFE_LOST) {
      audio.loseLife();
      announce(world.state.lives === 1 ? 'Ball lost. 1 life left.' : `Ball lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_GAME_OVER) endGame();
    else if (events & EVENT_VICTORY) winGame();
    audio.updateMusic();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting the ball drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Test and debug handle: the world state, the screen, and a way to start a run.
  window.__neon = {
    world,
    get screen() {
      return screen;
    },
    start: startGame,
  };

  announce('Neonbreaker. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

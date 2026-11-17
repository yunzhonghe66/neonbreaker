// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh run for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a real game looks like and the same seed always gives the same
// frame. Nothing here is faked: the play scene's ball really breaks bricks, and the end
// scene's pilot really misses them.

import { FIELD, STEP } from './config.js';
import { EVENT_GAME_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 45;
const END_LIMIT_SECONDS = 300;

/** Where a descending ball will cross the paddle's line, folded off the side walls. */
function landingX(ball) {
  if (ball.vy <= 0) return FIELD.width / 2;
  const t = (FIELD.height - 60 - ball.y) / ball.vy;
  let x = ball.x + ball.vx * t;
  const w = FIELD.width;
  x = ((x % (2 * w)) + 2 * w) % (2 * w);
  return x > w ? 2 * w - x : x;
}

/** Steer the paddle toward the ball's landing point; launch a stuck ball; fire lasers.
 * A slow sweep offset keeps the bounce angle changing, so the ball sweeps across the
 * wall instead of bouncing straight up and down one cleared channel forever. */
export function playPilot(state) {
  const paddle = state.paddle;
  const ball = state.balls.find((b) => b.active && !b.stuck) || state.balls.find((b) => b.active);
  const stuck = state.balls.some((b) => b.active && b.stuck);
  const sweep = Math.sin(state.time * 0.45) * 34;
  const target = ball ? landingX(ball) + sweep : paddle.x + paddle.width / 2;
  return {
    direction: 0,
    mouseTarget: target,
    usingKeyboard: false,
    confirm: stuck,
    fire: paddle.laserTimer > 0,
  };
}

/** Steer away from the ball, so every serve is lost — a hurried player's game over. */
function endPilot(state) {
  const ball = state.balls.find((b) => b.active && !b.stuck) || state.balls.find((b) => b.active);
  const stuck = state.balls.some((b) => b.active && b.stuck);
  const target = ball && ball.x < FIELD.width / 2 ? FIELD.width : 0;
  return { direction: 0, mouseTarget: target, usingKeyboard: false, confirm: stuck, fire: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.resetRun();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, playPilot(world.state), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilot = name === 'end' ? endPilot : playPilot;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, pilot(world.state), false);
    if (name === 'end' && events & EVENT_GAME_OVER) break;
    if (name === 'play' && world.state.over) break;
    if (name === 'play' && world.state.won) break;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

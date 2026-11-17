// The game's rules and state, with no drawing and no browser in it: the paddle, the
// balls, the bricks of the current level, falling power-ups, laser bolts, particles,
// combo scoring, lives and levels. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (and play sounds) without the world
// knowing about screens or sound. Nothing here allocates after createWorld returns, and
// every random choice comes from the seeded generator, so a seed replays exactly.

import {
  BALL,
  BRICK,
  COMBO,
  FIELD,
  GRID,
  LASER,
  LIVES,
  MAX_BALLS,
  MAX_LIVES,
  PADDLE,
  PARTICLE,
  POWERUP,
  ROW_COLORS,
} from './config.js';
import { LEVELS, countBreakable } from './levels.js';

export const EVENT_BRICK = 1;
export const EVENT_PADDLE = 2;
export const EVENT_POWERUP = 4;
export const EVENT_LIFE_LOST = 8;
export const EVENT_LEVEL_CLEAR = 16;
export const EVENT_GAME_OVER = 32;
export const EVENT_VICTORY = 64;
export const EVENT_LAUNCH = 128;
export const EVENT_LASER = 256;
export const EVENT_STEEL = 512;

const BALL_POOL = 6;
const POWERUP_POOL = 8;
const LASER_POOL = 12;

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createWorld(random) {
  const paddle = {
    x: (FIELD.width - PADDLE.width) / 2,
    y: PADDLE.y,
    width: PADDLE.width,
    height: PADDLE.height,
    wideTimer: 0,
    laserTimer: 0,
    laserCooldown: 0,
  };

  const balls = [];
  for (let i = 0; i < BALL_POOL; i += 1) {
    balls.push({ active: false, stuck: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const bricks = [];
  for (let i = 0; i < GRID.cols * GRID.rows; i += 1) {
    bricks.push({ active: false, type: '1', hp: 1, maxHp: 1, x: 0, y: 0, color: '#fff' });
  }
  const powerups = [];
  for (let i = 0; i < POWERUP_POOL; i += 1) {
    powerups.push({ active: false, kind: 'multi', x: 0, y: 0 });
  }
  const lasers = [];
  for (let i = 0; i < LASER_POOL; i += 1) {
    lasers.push({ active: false, x: 0, y: 0 });
  }
  const particles = [];
  for (let i = 0; i < PARTICLE.max; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });
  }
  const popups = [];
  for (let i = 0; i < 16; i += 1) {
    popups.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  }

  const state = {
    paddle,
    balls,
    bricks,
    powerups,
    lasers,
    particles,
    popups,
    score: 0,
    lives: LIVES,
    level: 0,
    combo: 0,
    multiplier: 1,
    broken: 0,
    bricksLeft: 0,
    time: 0,
    shake: 0,
    banner: null,
    bannerTimer: 0,
    slowTimer: 0,
    serveTimer: 0,
    won: false,
    over: false,
    attract: false,
    levelBonus: 0,
  };

  function freeBall() {
    for (const ball of balls) if (!ball.active) return ball;
    return null;
  }

  function freePowerup() {
    for (const item of powerups) if (!item.active) return item;
    return null;
  }

  function freeLaser() {
    for (const bolt of lasers) if (!bolt.active) return bolt;
    return null;
  }

  function freeParticle() {
    for (const p of particles) if (!p.active) return p;
    return null;
  }

  function freePopup() {
    for (const p of popups) if (!p.active) return p;
    return null;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const p = freeParticle();
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 320;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.color = color;
      p.size = 2 + random() * 4;
    }
  }

  function popup(x, y, text) {
    const p = freePopup();
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.text = text;
    p.life = 0.9;
  }

  function addShake(amount) {
    state.shake = Math.min(1, state.shake + amount);
  }

  function ballSpeed() {
    const level = LEVELS[state.level];
    const target =
      BALL.baseSpeed + BALL.speedPerBrick * state.broken + BALL.speedPerLevel * state.level + level.speedBonus;
    const capped = Math.min(BALL.maxSpeed, target);
    return state.slowTimer > 0 ? capped * BALL.slowMultiplier : capped;
  }

  function rescaleBall(ball) {
    const speed = ballSpeed();
    const len = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = (ball.vx / len) * speed;
    ball.vy = (ball.vy / len) * speed;
  }

  function serveBall() {
    const ball = freeBall();
    if (!ball) return;
    ball.active = true;
    ball.stuck = true;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - BALL.radius - 1;
    ball.vx = 0;
    ball.vy = 0;
    state.serveTimer = BALL.serveDelay;
  }

  function launchBall(ball) {
    const angle = (random() - 0.5) * 1.0;
    const speed = ballSpeed();
    ball.stuck = false;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.level = index;
    state.bricksLeft = countBreakable(level);
    state.broken = 0;
    state.combo = 0;
    state.multiplier = 1;
    state.slowTimer = 0;
    paddle.wideTimer = 0;
    paddle.laserTimer = 0;
    paddle.width = PADDLE.width;
    for (const ball of balls) {
      ball.active = false;
      ball.stuck = false;
    }
    for (const item of powerups) item.active = false;
    for (const bolt of lasers) bolt.active = false;
    let i = 0;
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        const brick = bricks[i];
        i += 1;
        const cell = level.rows[row][col];
        brick.active = cell !== '.';
        brick.type = cell;
        brick.hp = cell === '2' ? 2 : 1;
        brick.maxHp = brick.hp;
        brick.x = GRID.x0 + col * (GRID.brickWidth + GRID.gap);
        brick.y = GRID.y0 + row * (GRID.brickHeight + GRID.gap);
        brick.color = cell === 'S' ? '#9aa7bd' : ROW_COLORS[row];
      }
    }
    paddle.x = (FIELD.width - paddle.width) / 2;
    serveBall();
  }

  function resetRun() {
    state.score = 0;
    state.lives = LIVES;
    state.won = false;
    state.over = false;
    state.banner = null;
    state.bannerTimer = 0;
    state.time = 0;
    state.shake = 0;
    for (const p of particles) p.active = false;
    for (const p of popups) p.active = false;
    loadLevel(0);
  }

  function dropPowerup(x, y, force) {
    const item = freePowerup();
    if (!item) return;
    item.active = true;
    item.x = x;
    item.y = y;
    if (force) {
      item.kind = POWERUP.kinds[Math.floor(random() * POWERUP.kinds.length)];
    } else {
      // Weighted: multi-ball and wide are common, extra life is rare.
      const roll = random();
      item.kind = roll < 0.26 ? 'multi' : roll < 0.52 ? 'wide' : roll < 0.74 ? 'laser' : roll < 0.94 ? 'slow' : 'life';
    }
  }

  function applyPowerup(kind) {
    if (kind === 'multi') {
      const live = balls.filter((b) => b.active && !b.stuck);
      for (const ball of live) {
        for (let k = 0; k < 2; k += 1) {
          const extra = freeBall();
          if (!extra || balls.filter((b) => b.active).length >= MAX_BALLS) break;
          extra.active = true;
          extra.stuck = false;
          extra.x = ball.x;
          extra.y = ball.y;
          const speed = ballSpeed();
          const baseAngle = Math.atan2(ball.vy, ball.vx) + (k === 0 ? 0.5 : -0.5);
          extra.vx = Math.cos(baseAngle) * speed;
          extra.vy = Math.sin(baseAngle) * speed;
        }
      }
    } else if (kind === 'wide') {
      paddle.wideTimer = PADDLE.wideSeconds;
      paddle.width = PADDLE.width * PADDLE.wideMultiplier;
    } else if (kind === 'laser') {
      paddle.laserTimer = PADDLE.laserSeconds;
    } else if (kind === 'slow') {
      state.slowTimer = BALL.slowSeconds;
      for (const ball of balls) if (ball.active && !ball.stuck) rescaleBall(ball);
    } else if (kind === 'life') {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    }
  }

  function fireLasers() {
    if (paddle.laserTimer <= 0 || paddle.laserCooldown > 0) return false;
    paddle.laserCooldown = LASER.cooldown;
    for (const offset of [-1, 1]) {
      const bolt = freeLaser();
      if (!bolt) continue;
      bolt.active = true;
      bolt.x = paddle.x + paddle.width / 2 + offset * (paddle.width / 2 - 8);
      bolt.y = paddle.y - LASER.height;
    }
    return true;
  }

  function damageBrick(brick, events) {
    if (brick.type === 'S') {
      burst(brick.x + GRID.brickWidth / 2, brick.y + GRID.brickHeight / 2, '#cbd5e1', 3);
      addShake(0.08);
      return events | EVENT_STEEL;
    }
    brick.hp -= 1;
    if (brick.hp > 0) {
      burst(brick.x + GRID.brickWidth / 2, brick.y + GRID.brickHeight / 2, brick.color, 4);
      return events | EVENT_BRICK;
    }
    brick.active = false;
    state.broken += 1;
    state.bricksLeft -= 1;
    burst(brick.x + GRID.brickWidth / 2, brick.y + GRID.brickHeight / 2, brick.color, PARTICLE.shardsPerBrick);
    addShake(0.12);
    if (state.attract) return events | EVENT_BRICK;
    state.combo += 1;
    state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perStep));
    const base = brick.type === 'B' ? BRICK.bonusPoints : brick.type === '2' ? BRICK.hardPoints : BRICK.normalPoints;
    const points = base * state.multiplier;
    state.score += points;
    popup(brick.x + GRID.brickWidth / 2, brick.y, `+${points}`);
    if (brick.type === 'B') dropPowerup(brick.x + GRID.brickWidth / 2, brick.y, true);
    else if (random() < BRICK.dropChance) dropPowerup(brick.x + GRID.brickWidth / 2, brick.y, false);
    return events | EVENT_BRICK;
  }

  /** Circle-versus-brick test; reflects the ball and damages the brick on a hit. */
  function collideBallBrick(ball) {
    for (const brick of bricks) {
      if (!brick.active) continue;
      const cx = Math.max(brick.x, Math.min(ball.x, brick.x + GRID.brickWidth));
      const cy = Math.max(brick.y, Math.min(ball.y, brick.y + GRID.brickHeight));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue;
      // Reflect on the shallow axis: the side the ball came in through.
      const overlapX = GRID.brickWidth / 2 + BALL.radius - Math.abs(ball.x - (brick.x + GRID.brickWidth / 2));
      const overlapY = GRID.brickHeight / 2 + BALL.radius - Math.abs(ball.y - (brick.y + GRID.brickHeight / 2));
      if (overlapX < overlapY) {
        ball.vx = -ball.vx;
        ball.x += ball.vx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y += ball.vy > 0 ? overlapY : -overlapY;
      }
      return brick;
    }
    return null;
  }

  function stepBall(ball, dt, events) {
    if (ball.stuck) {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - BALL.radius - 1;
      return events;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < BALL.radius) {
      ball.x = BALL.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > FIELD.width - BALL.radius) {
      ball.x = FIELD.width - BALL.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < BALL.radius) {
      ball.y = BALL.radius;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle: the bounce angle follows where the ball lands on the paddle.
    if (
      ball.vy > 0 &&
      ball.y + BALL.radius >= paddle.y &&
      ball.y - BALL.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x - BALL.radius &&
      ball.x <= paddle.x + paddle.width + BALL.radius
    ) {
      const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
      const angle = offset * 1.05;
      const speed = ballSpeed();
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.y = paddle.y - BALL.radius - 0.5;
      state.combo = 0;
      state.multiplier = 1;
      burst(ball.x, paddle.y, '#7df9ff', 5);
      events |= EVENT_PADDLE;
    }

    const brick = collideBallBrick(ball);
    if (brick) {
      events = damageBrick(brick, events);
      rescaleBall(ball);
    }

    if (ball.y - BALL.radius > FIELD.height) {
      ball.active = false;
      ball.stuck = false;
    }
    return events;
  }

  /**
   * One fixed step. `input` is { direction, mouseTarget, usingKeyboard, confirm, fire }.
   * With `attract` set (the title screen's backdrop) the ball never costs a life, a
   * cleared level silently reloads, and nothing scores.
   */
  function step(dt, input, attract) {
    let events = 0;
    state.attract = attract;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);
    if (state.slowTimer > 0) state.slowTimer = Math.max(0, state.slowTimer - dt);
    if (paddle.laserCooldown > 0) paddle.laserCooldown -= dt;

    if (paddle.wideTimer > 0) {
      paddle.wideTimer -= dt;
      if (paddle.wideTimer <= 0) {
        paddle.width = PADDLE.width;
        paddle.x = Math.min(FIELD.width - paddle.width, Math.max(0, paddle.x));
      }
    }
    if (paddle.laserTimer > 0) paddle.laserTimer -= dt;

    // Level-clear banner: freeze play, then move on.
    if (state.banner) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        state.banner = null;
        if (state.won) {
          events |= EVENT_VICTORY;
        } else {
          loadLevel(state.level + 1);
        }
      }
      updateParticles(dt);
      updatePopups(dt);
      return events;
    }

    // Paddle steering: keyboard wins while held, otherwise the mouse target.
    if (input.usingKeyboard) {
      paddle.x += input.direction * PADDLE.keyboardSpeed * dt;
    } else if (input.mouseTarget !== null && input.mouseTarget !== undefined) {
      const target = input.mouseTarget - paddle.width / 2;
      const diff = target - paddle.x;
      const move = Math.max(-PADDLE.mouseSpeed * dt, Math.min(PADDLE.mouseSpeed * dt, diff));
      paddle.x += move;
    }
    paddle.x = Math.min(FIELD.width - paddle.width, Math.max(0, paddle.x));

    if (input.fire && fireLasers()) events |= EVENT_LASER;

    // Serve: a stuck ball launches on confirm, or on its own after a short delay.
    const stuck = balls.find((b) => b.active && b.stuck);
    if (stuck) {
      if (state.serveTimer > 0) state.serveTimer -= dt;
      if (input.confirm || state.serveTimer <= 0 || attract) {
        launchBall(stuck);
        events |= EVENT_LAUNCH;
      }
    }

    for (const ball of balls) {
      if (ball.active) events = stepBall(ball, dt, events);
    }

    // Lasers fly up and chip bricks.
    for (const bolt of lasers) {
      if (!bolt.active) continue;
      bolt.y -= LASER.speed * dt;
      if (bolt.y < 0) {
        bolt.active = false;
        continue;
      }
      for (const brick of bricks) {
        if (!brick.active) continue;
        if (bolt.x >= brick.x && bolt.x <= brick.x + GRID.brickWidth && bolt.y >= brick.y && bolt.y <= brick.y + GRID.brickHeight) {
          bolt.active = false;
          events = damageBrick(brick, events);
          break;
        }
      }
    }

    // Power-up capsules fall and are caught by the paddle.
    for (const item of powerups) {
      if (!item.active) continue;
      item.y += POWERUP.fallSpeed * dt;
      if (item.y > FIELD.height) {
        item.active = false;
        continue;
      }
      if (
        rectsOverlap(item.x - POWERUP.size / 2, item.y - POWERUP.size / 2, POWERUP.size, POWERUP.size, paddle.x, paddle.y, paddle.width, paddle.height)
      ) {
        item.active = false;
        applyPowerup(item.kind);
        burst(paddle.x + paddle.width / 2, paddle.y, '#ffd166', 10);
        events |= EVENT_POWERUP;
      }
    }

    updateParticles(dt);
    updatePopups(dt);

    if (state.bricksLeft <= 0 && !attract) {
      const bonus = 1000 + 250 * state.level;
      state.score += bonus;
      state.levelBonus = bonus;
      if (state.level >= LEVELS.length - 1) {
        state.won = true;
        state.banner = 'YOU WIN';
        state.bannerTimer = 2.2;
      } else {
        state.banner = `LEVEL ${state.level + 2}`;
        state.bannerTimer = 1.8;
      }
      events |= EVENT_LEVEL_CLEAR;
      return events;
    }
    if (state.bricksLeft <= 0 && attract) {
      loadLevel(state.level);
      return events;
    }

    // No ball left in play: lose a life (or respawn forever in attract mode).
    const anyBall = balls.some((b) => b.active);
    if (!anyBall && !state.banner) {
      if (attract) {
        serveBall();
      } else {
        state.lives -= 1;
        state.combo = 0;
        state.multiplier = 1;
        addShake(0.6);
        events |= EVENT_LIFE_LOST;
        if (state.lives <= 0) {
          state.over = true;
          events |= EVENT_GAME_OVER;
        } else {
          serveBall();
        }
      }
    }

    return events;
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updatePopups(dt) {
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      else p.y -= 34 * dt;
    }
  }

  resetRun();
  return { state, resetRun, loadLevel, step, serveBall };
}

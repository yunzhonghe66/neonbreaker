// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon look: bright cores, translucent glow rects, a few shadowBlur accents on the
// ball and paddle only (never per brick, so a full wall stays fast). Every animation is
// driven by the world's own clock, so a staged screenshot is the same every time.

import { BALL, FIELD, FONT, GRID, PALETTE, POWERUP } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 34, bottom: 78 };
const POWERUP_COLORS = { multi: '#e879f9', wide: '#38f2ff', laser: '#ff5470', slow: '#4ade80', life: '#ffd166' };
const POWERUP_LETTERS = { multi: 'M', wide: 'W', laser: 'L', slow: 'S', life: '+' };

/** Deterministic starfield: positions from a fixed hash of the index, never Math.random. */
const STARS = [];
for (let i = 0; i < 90; i += 1) {
  const x = (i * 397.13 + 61) % FIELD.width;
  const y = (i * 251.71 + 37) % FIELD.height;
  STARS.push({ x, y, r: 0.6 + ((i * 7) % 10) / 10, a: 0.25 + ((i * 13) % 10) / 22 });
}

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const levelLabel = cachedLabel('LEVEL ');
  const finalLabel = cachedLabel('SCORE ');
  const bestFinalLabel = cachedLabel('BEST ');
  const trail = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || 400}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function glowRect(x, y, w, h, color, glowAlpha) {
    context.globalAlpha = glowAlpha;
    context.fillStyle = color;
    context.fillRect(x - 4, y - 4, w + 8, h + 8);
    context.globalAlpha = 1;
  }

  function drawBackground(state) {
    context.fillStyle = PALETTE.field;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of STARS) {
      const twinkle = 0.6 + 0.4 * Math.sin(state.time * 1.7 + star.x * 0.05);
      context.globalAlpha = star.a * twinkle;
      context.fillStyle = '#bcd8ff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.gridLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
  }

  function drawBrick(brick, time) {
    const { x, y } = brick;
    const w = GRID.brickWidth;
    const h = GRID.brickHeight;
    if (brick.type === 'S') {
      context.fillStyle = '#5b6b82';
      context.fillRect(x, y, w, h);
      context.fillStyle = '#9aa7bd';
      context.fillRect(x + 2, y + 2, w - 4, h - 10);
      context.fillStyle = '#e2e8f0';
      context.fillRect(x + 5, y + 5, 4, 4);
      context.fillRect(x + w - 9, y + 5, 4, 4);
      context.fillStyle = '#475569';
      context.fillRect(x, y + h - 5, w, 5);
      return;
    }
    if (brick.type === 'B') {
      const pulse = 0.55 + 0.45 * Math.sin(time * 5);
      glowRect(x, y, w, h, '#ffd166', 0.25 + 0.3 * pulse);
      context.fillStyle = '#ffd166';
      context.fillRect(x, y, w, h);
      context.fillStyle = '#fff7d6';
      context.fillRect(x + 3, y + 3, w - 6, 8);
      context.fillStyle = '#7c5b00';
      text('★', x + w / 2, y + h - 7, 20, '#7c5b00', 'center', 700);
      return;
    }
    glowRect(x, y, w, h, brick.color, 0.22);
    context.fillStyle = brick.color;
    context.fillRect(x, y, w, h);
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillRect(x + 2, y + 2, w - 4, 5);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(x + 2, y + h - 6, w - 4, 4);
    if (brick.type === '2' && brick.hp < brick.maxHp) {
      // A cracked hard brick shows its damage.
      context.strokeStyle = '#1e293b';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 8, y + 4);
      context.lineTo(x + w / 2, y + h / 2);
      context.lineTo(x + w - 12, y + h - 4);
      context.moveTo(x + w - 8, y + 6);
      context.lineTo(x + w / 2 - 6, y + h / 2 + 4);
      context.stroke();
    }
  }

  function drawPaddle(paddle, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    context.save();
    context.shadowColor = PALETTE.paddle;
    context.shadowBlur = 18 + pulse * 8;
    context.fillStyle = PALETTE.paddle;
    const r = 9;
    context.beginPath();
    context.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, r);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.paddleCore;
    context.fillRect(paddle.x + 8, paddle.y + 4, paddle.width - 16, 4);
    if (paddle.laserTimer > 0) {
      context.fillStyle = '#ff5470';
      context.fillRect(paddle.x + 4, paddle.y - 10, 6, 10);
      context.fillRect(paddle.x + paddle.width - 10, paddle.y - 10, 6, 10);
    }
  }

  function drawBall(ball, time) {
    let points = trail.get(ball);
    if (!points) {
      points = [];
      trail.set(ball, points);
    }
    points.push({ x: ball.x, y: ball.y });
    if (points.length > 7) points.shift();
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      context.globalAlpha = (i / points.length) * 0.35;
      context.fillStyle = PALETTE.ballGlow;
      context.beginPath();
      context.arc(p.x, p.y, BALL.radius * (0.4 + 0.6 * (i / points.length)), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.save();
    context.shadowColor = PALETTE.ballGlow;
    context.shadowBlur = 16;
    context.fillStyle = PALETTE.ball;
    context.beginPath();
    context.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPowerup(item, time) {
    const color = POWERUP_COLORS[item.kind];
    const bob = Math.sin(time * 6 + item.x) * 2;
    const y = item.y + bob;
    const s = POWERUP.size;
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 12;
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(item.x - s / 2, y - s / 2, s, s, 6);
    context.fill();
    context.restore();
    context.fillStyle = '#0a0d1f';
    text(POWERUP_LETTERS[item.kind], item.x, y + 7, 18, '#0a0d1f', 'center', 800);
  }

  function drawLaser(bolt) {
    context.save();
    context.shadowColor = '#ff5470';
    context.shadowBlur = 10;
    context.fillStyle = '#ffd166';
    context.fillRect(bolt.x - 3, bolt.y, 6, 22);
    context.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawPopups(state) {
    for (const p of state.popups) {
      if (!p.active) continue;
      context.globalAlpha = Math.min(1, p.life / 0.5);
      text(p.text, p.x, p.y, 20, '#ffffff', 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left', 700);
    text(bestLabel(best), 24, 48, 16, PALETTE.muted, 'left');
    text(levelLabel(state.level + 1), FIELD.width / 2, 18, 26, PALETTE.text, 'center', 700);
    text(`LEVEL ${state.level + 1} / 10`, FIELD.width / 2, 48, 14, PALETTE.muted, 'center');
    const livesText = `LIVES ${state.lives}`;
    text(livesText, FIELD.width - 24, 18, 26, state.lives <= 1 ? PALETTE.danger : PALETTE.text, 'right', 700);
    for (let i = 0; i < state.lives; i += 1) {
      context.fillStyle = PALETTE.paddle;
      context.fillRect(FIELD.width - 24 - (i + 1) * 30, 52, 22, 6);
    }
    if (state.multiplier > 1) {
      const x = FIELD.width / 2 + 120;
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.roundRect(x, 14, 92, 32, 8);
      context.fill();
      text(`COMBO x${state.multiplier}`, x + 46, 22, 18, '#0a0d1f', 'center', 800);
    }
    // Active effect chips, with seconds left.
    let chipX = 24;
    const chips = [];
    if (state.paddle.wideTimer > 0) chips.push(`WIDE ${Math.ceil(state.paddle.wideTimer)}s`);
    if (state.paddle.laserTimer > 0) chips.push(`LASER ${Math.ceil(state.paddle.laserTimer)}s`);
    if (state.slowTimer > 0) chips.push(`SLOW ${Math.ceil(state.slowTimer)}s`);
    for (const chip of chips) {
      context.fillStyle = 'rgba(56,242,255,0.15)';
      context.strokeStyle = '#38f2ff';
      context.lineWidth = 1;
      const w = chip.length * 9 + 18;
      context.beginPath();
      context.roundRect(chipX, 676, w, 26, 6);
      context.fill();
      context.stroke();
      text(chip, chipX + w / 2, 682, 14, '#38f2ff', 'center', 700);
      chipX += w + 8;
    }
    if (muted) text('MUTED (M)', FIELD.width - 24, 676, 14, PALETTE.muted, 'right');
  }

  function drawBanner(state) {
    if (!state.banner) return;
    const alpha = Math.min(1, state.bannerTimer);
    context.globalAlpha = alpha;
    context.save();
    context.shadowColor = '#38f2ff';
    context.shadowBlur = 30;
    text(state.banner, FIELD.width / 2, 330, 64, '#e8feff', 'center', 800);
    context.restore();
    if (state.levelBonus > 0 && state.banner === 'YOU WIN') {
      text(`LEVEL BONUS +${state.levelBonus}`, FIELD.width / 2, 390, 24, PALETTE.gold, 'center', 700);
    } else if (state.levelBonus > 0) {
      text(`LEVEL BONUS +${state.levelBonus}`, FIELD.width / 2, 390, 24, PALETTE.gold, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,6,15,0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = '#0d1226';
    context.strokeStyle = accent || '#38f2ff';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.stroke();
    context.textBaseline = 'alphabetic';
    context.save();
    context.shadowColor = accent || '#38f2ff';
    context.shadowBlur = 24;
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center', 800);
    context.restore();
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center', 700);
  }

  const TITLE_LINES = [
    'Break every brick. Clear all 10 neon grids.',
    'Move with ← → or A D, or steer with the mouse.',
    'Catch M W L S + capsules. P pauses. M mutes.',
    '',
  ];
  const PAUSED_LINES = ['The ball waits for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    const shakeX = state.shake * 9 * Math.sin(state.time * 91);
    const shakeY = state.shake * 9 * Math.cos(state.time * 113);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state);
    for (const brick of state.bricks) if (brick.active) drawBrick(brick, state.time);
    for (const item of state.powerups) if (item.active) drawPowerup(item, state.time);
    for (const bolt of state.lasers) if (bolt.active) drawLaser(bolt);
    drawPaddle(state.paddle, state.time);
    for (const ball of state.balls) {
      if (!ball.active) {
        trail.delete(ball);
        continue;
      }
      drawBall(ball, state.time);
    }
    drawParticles(state);
    drawPopups(state);

    if (screen === SCREEN_TITLE) {
      // Dim the attract backdrop so the title and subtitle read over the bricks.
      context.fillStyle = 'rgba(5,6,15,0.5)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.save();
      context.shadowColor = '#38f2ff';
      context.shadowBlur = 34;
      text('NEONBREAKER', FIELD.width / 2, 208, 84, '#e8feff', 'center', 800);
      context.restore();
      context.save();
      context.shadowColor = '#e879f9';
      context.shadowBlur = 18;
      text('A NEON ARCADE GAME  ·  10 LEVELS', FIELD.width / 2, 258, 22, '#e879f9', 'center', 700);
      context.restore();
      TITLE_LINES[3] = bestLabel(best);
      const panelY = 300;
      context.fillStyle = 'rgba(13,18,38,0.85)';
      context.strokeStyle = '#38f2ff';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect((FIELD.width - 640) / 2, panelY, 640, 240, 16);
      context.fill();
      context.stroke();
      context.textBaseline = 'alphabetic';
      for (let i = 0; i < TITLE_LINES.length; i += 1) {
        text(TITLE_LINES[i], FIELD.width / 2, panelY + 52 + i * 34, 20, i === 3 ? PALETTE.gold : PALETTE.muted, 'center', i === 3 ? 700 : 400);
      }
      const blink = 0.6 + 0.4 * Math.sin(state.time * 4);
      context.globalAlpha = blink;
      text('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 610, 24, PALETTE.gold, 'center', 700);
      context.globalAlpha = 1;
      return;
    }

    drawHud(state, best, muted);
    drawBanner(state);
    const stuck = state.balls.find((b) => b.active && b.stuck);
    if (screen === SCREEN_PLAY && stuck && !state.banner) {
      const blink = 0.6 + 0.4 * Math.sin(state.time * 4);
      context.globalAlpha = blink;
      text('SPACE OR CLICK TO LAUNCH', FIELD.width / 2, 560, 22, PALETTE.gold, 'center', 700);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PAUSED_LINES, 'Press P to resume', '#38f2ff');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestFinalLabel(best);
      drawPanel('GAME OVER', OVER_LINES, 'Press Space or click to play again', '#ff5470');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestFinalLabel(best);
      WIN_LINES[2] = 'You cleared all 10 neon grids.';
      drawPanel('YOU WIN', WIN_LINES, 'Press Space or click to play again', '#ffd166');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

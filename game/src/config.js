// NEONBREAKER — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. All art is drawn in code and all sound is synthesised, so the game has
// no asset files at all.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The brick grid: 12 columns, 6 rows, centred under the HUD. */
export const GRID = {
  cols: 12,
  rows: 6,
  brickWidth: 88,
  brickHeight: 28,
  gap: 6,
  x0: 79,
  y0: 96,
};

export const PADDLE = {
  width: 120,
  height: 18,
  y: 664,
  keyboardSpeed: 660,
  mouseSpeed: 1500,
  wideMultiplier: 1.6,
  wideSeconds: 15,
  laserSeconds: 10,
};

export const BALL = {
  radius: 9,
  baseSpeed: 420,
  speedPerBrick: 6,
  speedPerLevel: 18,
  maxSpeed: 780,
  serveDelay: 0.6,
  slowMultiplier: 0.55,
  slowSeconds: 8,
};

export const LIVES = 3;
export const MAX_LIVES = 5;
export const MAX_BALLS = 5;

/** Brick hit points and points, by type. */
export const BRICK = {
  normalPoints: 50,
  hardPoints: 100,
  bonusPoints: 500,
  /** Chance a broken normal or hard brick drops a power-up capsule. */
  dropChance: 0.18,
};

/** Combo: every brick broken without the ball touching the paddle adds one; the
 * multiplier grows one step per 4 combo and resets when a ball hits the paddle. */
export const COMBO = { perStep: 4, maxMultiplier: 5 };

export const POWERUP = {
  fallSpeed: 170,
  size: 26,
  kinds: ['multi', 'wide', 'laser', 'slow', 'life'],
};

export const LASER = {
  speed: 920,
  width: 6,
  height: 22,
  cooldown: 0.22,
};

export const PARTICLE = { shardsPerBrick: 9, max: 320 };

/** Neon row colours, top row to bottom row. */
export const ROW_COLORS = ['#22d3ee', '#4ade80', '#facc15', '#fb923c', '#e879f9', '#f87171'];

export const PALETTE = {
  backdrop: '#05060f',
  field: '#0a0d1f',
  gridLine: '#141a33',
  text: '#e8f6ff',
  muted: '#8b98b8',
  gold: '#ffd166',
  paddle: '#38f2ff',
  paddleCore: '#e8feff',
  ball: '#ffffff',
  ballGlow: '#7df9ff',
  steel: '#9aa7bd',
  steelEdge: '#e2e8f0',
  hardCrack: '#1e293b',
  danger: '#ff5470',
  ok: '#4ade80',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neonbreaker.best';

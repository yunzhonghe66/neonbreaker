// NEONBREAKER's ten hand-designed levels. Each layout is 6 rows of 12 cells:
//   '.' empty, '1' normal brick, '2' hard brick (2 hits), 'S' steel (unbreakable),
//   'B' bonus brick (500 points, always drops a power-up).
// The layouts are the game's own designs, drawn from the neon-grid idea, not copied
// from any other Breakout game.

export const LEVELS = [
  {
    name: 'FIRST LIGHT',
    speedBonus: 0,
    rows: [
      '.1111111111.',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
      '.1111111111.',
    ],
  },
  {
    name: 'CHECKERBOARD',
    speedBonus: 10,
    rows: [
      '121212121212',
      '212121212121',
      '121212121212',
      '212121212121',
      '121212121212',
      '212121212121',
    ],
  },
  {
    name: 'THE DIAMOND',
    speedBonus: 20,
    rows: [
      '.....11.....',
      '....1111....',
      '...111111...',
      '..11111111..',
      '.1111111111.',
      '111111111111',
    ],
  },
  {
    name: 'TWIN PEAKS',
    speedBonus: 30,
    rows: [
      '....11..11..',
      '...11111111.',
      '..1111111111',
      '.11111111111',
      '111111111111',
      '111111111111',
    ],
  },
  {
    name: 'STEEL FRAME',
    speedBonus: 40,
    rows: [
      'SSSSSSSSSSSS',
      'S1111111111S',
      'S1111BB1111S',
      'S1111111111S',
      'S1111111111S',
      'SSSSSSSSSSSS',
    ],
  },
  {
    name: 'THE FORTRESS',
    speedBonus: 50,
    rows: [
      '.11SSSSSS11.',
      '.1222222221.',
      '.122B22B221.',
      '.1222222221.',
      '.11SSSSSS11.',
      '.....11.....',
    ],
  },
  {
    name: 'ZIGZAG',
    speedBonus: 60,
    rows: [
      '111111111111',
      '.11111111111',
      '11111111111.',
      '.11111111111',
      '11111111111.',
      '111111111111',
    ],
  },
  {
    name: 'THE VAULT',
    speedBonus: 70,
    rows: [
      'SSSSSSSSSSSS',
      'S2222222222S',
      'S21BBBBBB12S',
      'S21B2222B12S',
      'S2222222222S',
      'SSSSSSSSSSSS',
    ],
  },
  {
    name: 'RAINBOW FALL',
    speedBonus: 80,
    rows: [
      '222222222222',
      '222222222222',
      '111111111111',
      '111111111111',
      '222222222222',
      '111111111111',
    ],
  },
  {
    name: 'THE CORE',
    speedBonus: 90,
    rows: [
      'SSSSSSSSSSSS',
      'S2222222222S',
      'S2211111122S',
      'S221B11B122S',
      'S2211111122S',
      'S2222222222S',
    ],
  },
];

/** How many bricks in a layout can be broken (steel does not count). */
export function countBreakable(level) {
  let count = 0;
  for (const row of level.rows) {
    for (const cell of row) if (cell === '1' || cell === '2' || cell === 'B') count += 1;
  }
  return count;
}

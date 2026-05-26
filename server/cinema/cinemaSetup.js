// cinema setup - builds the full 15 row x 28 col grid
// rows A to O, columns 1 to 28

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];
const COLS = 28;

// VIP zone: rows E to I (index 4-8), columns 12-15 (index 11-14)
const VIP_ROW_START = 4;
const VIP_ROW_END   = 8;
const VIP_COL_START = 11;
const VIP_COL_END   = 14;

/**
 * Generate exactly 6 disability seats in rows A and B.
 * ALL 6 must be adjacent to each other (one continuous block).
 * The block start position is randomised every session.
 *
 * Strategy:
 *  - Pick a random row (A or B)
 *  - Pick a random start column so that cols [start .. start+5] all fit (cols 1-28)
 *  - Mark all 6 consecutive seats in that row as DISABILITY
 *
 * This guarantees: exactly 6 seats, all adjacent, rows A/B only, random each reset.
 */
function generateDisabilityPositions() {
  const row = Math.random() < 0.5 ? 'A' : 'B';          // random row A or B
  const maxStart = COLS - 6;                              // latest start so 6 fit (0-based: 0..22)
  const startCol = Math.floor(Math.random() * (maxStart + 1)); // 0-based index

  const positions = new Set();
  for (let i = 0; i < 6; i++) {
    positions.add(`${row}-${startCol + i + 1}`); // store as "A-5" etc (1-based col)
  }
  return positions;
}

function getSeatType(rowIndex, colIndex, disabilitySet) {
  const row = ROWS[rowIndex];
  const col = colIndex + 1; // 1-based

  if (disabilitySet.has(`${row}-${col}`)) return 'DISABILITY';

  if (
    rowIndex >= VIP_ROW_START &&
    rowIndex <= VIP_ROW_END   &&
    colIndex >= VIP_COL_START &&
    colIndex <= VIP_COL_END
  ) return 'VIP';

  return 'REGULAR';
}

function generateBrokenSeats(cinema) {
  // 6-10 broken seats, max 2 per row, never adjacent, never on DISABILITY or VIP
  const totalBroken = Math.floor(Math.random() * 5) + 6;
  let placed = 0;
  let attempts = 0;

  while (placed < totalBroken && attempts < 500) {
    attempts++;
    const rowIndex = Math.floor(Math.random() * ROWS.length);
    const colIndex = Math.floor(Math.random() * COLS);
    const seat = cinema[rowIndex][colIndex];

    if (seat.type !== 'REGULAR' || seat.status === 'BROKEN') continue;

    const brokenInRow = cinema[rowIndex].filter(s => s.status === 'BROKEN').length;
    if (brokenInRow >= 2) continue;

    const leftBroken  = colIndex > 0        && cinema[rowIndex][colIndex - 1].status === 'BROKEN';
    const rightBroken = colIndex < COLS - 1  && cinema[rowIndex][colIndex + 1].status === 'BROKEN';
    if (leftBroken || rightBroken) continue;

    seat.status = 'BROKEN';
    placed++;
  }
}

function createCinema() {
  // Fresh disability positions every session
  const disabilitySet = generateDisabilityPositions();

  const cinema = [];
  for (let r = 0; r < ROWS.length; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        row:    ROWS[r],
        col:    c + 1,
        type:   getSeatType(r, c, disabilitySet),
        status: 'FREE'
      });
    }
    cinema.push(row);
  }

  generateBrokenSeats(cinema);
  return cinema;
}

module.exports = { createCinema, ROWS, COLS };

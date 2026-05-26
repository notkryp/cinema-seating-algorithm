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
 * Generate exactly 6 disability seats as 3 pairs of 2 adjacent seats.
 * Each pair is placed randomly in row A or B at a random column.
 * Pairs are placed independently - they may or may not end up next to each other
 * purely by chance of the randomiser. No constraint forces them apart or together.
 *
 * Rules:
 *  - Each pair = 2 horizontally adjacent seats (col N and col N+1)
 *  - Each pair is in either row A or row B (random per pair)
 *  - Start column is random: 1 to 27 (so col+1 stays within 28)
 *  - No deliberate minimum gap between pairs - randomiser decides
 */
function generateDisabilityPositions() {
  const positions = new Set();
  const placedPairs = []; // track [{row, startCol}] to avoid exact duplicates only

  let attempts = 0;
  while (placedPairs.length < 3 && attempts < 200) {
    attempts++;
    const row = Math.random() < 0.5 ? 'A' : 'B';
    const startCol = Math.floor(Math.random() * (COLS - 1)) + 1; // 1 to 27

    // avoid placing an identical pair at the exact same spot
    const duplicate = placedPairs.some(p => p.row === row && p.startCol === startCol);
    if (duplicate) continue;

    placedPairs.push({ row, startCol });
    positions.add(`${row}-${startCol}`);
    positions.add(`${row}-${startCol + 1}`);
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
  // Fresh disability positions every session - 3 random pairs across rows A and B
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

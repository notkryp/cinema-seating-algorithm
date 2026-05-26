// cinema setup - builds the full 15 row x 28 col grid
// rows A to O, columns 1 to 28

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];
const COLS = 28;

// VIP zone: rows E to I (index 4 to 8), columns 12 to 15 (index 11 to 14)
const VIP_ROW_START = 4;
const VIP_ROW_END = 8;
const VIP_COL_START = 11;
const VIP_COL_END = 14;

// disability seats: 6 seats total in rows A and B, always adjacent
// placing 3 in row A starting col 1 and 3 in row B starting col 1
const DISABILITY_SEATS = [
  { row: 'A', cols: [1, 2, 3] },
  { row: 'B', cols: [1, 2, 3] }
];

function getSeatType(rowIndex, colIndex) {
  const row = ROWS[rowIndex];
  const col = colIndex + 1;

  // check disability first
  for (const ds of DISABILITY_SEATS) {
    if (ds.row === row && ds.cols.includes(col)) {
      return 'DISABILITY';
    }
  }

  // check VIP zone
  if (
    rowIndex >= VIP_ROW_START &&
    rowIndex <= VIP_ROW_END &&
    colIndex >= VIP_COL_START &&
    colIndex <= VIP_COL_END
  ) {
    return 'VIP';
  }

  return 'REGULAR';
}

function generateBrokenSeats(cinema) {
  // between 6 and 10 broken seats per session
  // max 2 per row, never adjacent
  const totalBroken = Math.floor(Math.random() * 5) + 6; // 6 to 10
  let placed = 0;
  let attempts = 0;

  while (placed < totalBroken && attempts < 500) {
    attempts++;
    const rowIndex = Math.floor(Math.random() * ROWS.length);
    const colIndex = Math.floor(Math.random() * COLS);
    const seat = cinema[rowIndex][colIndex];

    // skip already broken, VIP, disability, or occupied seats
    if (seat.type !== 'REGULAR' || seat.status === 'BROKEN') continue;

    // check max 2 broken per row
    const brokenInRow = cinema[rowIndex].filter(s => s.status === 'BROKEN').length;
    if (brokenInRow >= 2) continue;

    // check not adjacent to another broken seat
    const leftBroken = colIndex > 0 && cinema[rowIndex][colIndex - 1].status === 'BROKEN';
    const rightBroken = colIndex < COLS - 1 && cinema[rowIndex][colIndex + 1].status === 'BROKEN';
    if (leftBroken || rightBroken) continue;

    seat.status = 'BROKEN';
    placed++;
  }
}

function createCinema() {
  const cinema = [];

  for (let r = 0; r < ROWS.length; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        row: ROWS[r],
        col: c + 1,
        type: getSeatType(r, c),
        status: 'FREE'
      });
    }
    cinema.push(row);
  }

  // mark broken seats for this session
  generateBrokenSeats(cinema);

  return cinema;
}

module.exports = { createCinema, ROWS, COLS };

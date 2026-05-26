// main seating algorithm
// the goal is to fill the cinema without leaving single scattered empty seats
// a scattered seat is one that is free but has booked seats on both sides - hard to sell later

const { ROWS } = require('./cinemaSetup');

// count single isolated free seats in a row after a simulated booking
// a single gap = a free seat with both neighbours booked (or at the wall with only one booked neighbour)
function countSingleGaps(row) {
  let count = 0;
  const n = row.length;

  for (let i = 0; i < n; i++) {
    const seat = row[i];
    if (seat.status !== 'FREE' || seat.type === 'BROKEN') continue;

    const leftBooked = i === 0
      ? false
      : row[i - 1].status === 'BOOKED';

    const rightBooked = i === n - 1
      ? false
      : row[i + 1].status === 'BOOKED';

    if (leftBooked && rightBooked) {
      count++;
    }
  }

  return count;
}

// simulate placing a block of seats and get the gap count result
function simulateBlock(row, startColIndex, groupSize) {
  const rowCopy = row.map(s => ({ ...s }));
  for (let i = 0; i < groupSize; i++) {
    rowCopy[startColIndex + i].status = 'BOOKED';
  }
  const gapsAfter = countSingleGaps(rowCopy);

  // how far from centre column (13.5 for 28 cols, 0-indexed)
  const centerCol = (row.length - 1) / 2;
  const blockCenter = startColIndex + (groupSize - 1) / 2;
  const centerDistance = Math.abs(blockCenter - centerCol);

  return { gapsAfter, centerDistance };
}

// rows preferred for normal bookings - middle rows first (cinema-style preference)
function getPreferredRowOrder() {
  const indices = ROWS.map((_, i) => i);
  const center = Math.floor(indices.length / 2);
  return [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

// book disability seats - only rows A (0) and B (1), only disability type seats
function allocateDisability(cinema, groupSize) {
  const targetRows = [0, 1];
  let best = null;

  for (const r of targetRows) {
    const row = cinema[r];
    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (seat.type !== 'DISABILITY' || seat.status !== 'FREE') {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, groupSize);
      if (!best || gapsAfter < best.gapsAfter) {
        best = { rowIndex: r, start: c, gapsAfter, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// book VIP seats - only rows E to I (index 4 to 8), columns 12 to 15 (index 11 to 14)
function allocateVIP(cinema, groupSize) {
  const candidates = [];

  for (let r = 4; r <= 8; r++) {
    const row = cinema[r];
    for (let c = 11; c <= 14 - groupSize + 1; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (seat.type !== 'VIP' || seat.status !== 'FREE') {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, groupSize);
      candidates.push({ rowIndex: r, start: c, gapsAfter, centerDistance });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.gapsAfter !== b.gapsAfter) return a.gapsAfter - b.gapsAfter;
    return a.centerDistance - b.centerDistance;
  });

  const best = candidates[0];
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// book a group of 2 to 7 people
// uses anti-scatter: picks the block that creates fewest single gaps
function allocateGroup(cinema, groupSize) {
  const rowOrder = getPreferredRowOrder();
  const candidates = [];

  for (const r of rowOrder) {
    const row = cinema[r];

    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (
          seat.status !== 'FREE' ||
          seat.type === 'BROKEN' ||
          seat.type === 'DISABILITY'
        ) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, groupSize);
      candidates.push({ rowIndex: r, start: c, gapsAfter, centerDistance });
    }
  }

  if (candidates.length === 0) return null;

  // pick the option that creates fewest gaps, then closest to centre
  candidates.sort((a, b) => {
    if (a.gapsAfter !== b.gapsAfter) return a.gapsAfter - b.gapsAfter;
    return a.centerDistance - b.centerDistance;
  });

  const best = candidates[0];
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// book a solo - try not to place them between groups
// prefer seats at ends of partially filled rows or in already-gap positions
function allocateSolo(cinema) {
  const rowOrder = getPreferredRowOrder();
  let best = null;

  for (const r of rowOrder) {
    const row = cinema[r];

    for (let c = 0; c < row.length; c++) {
      const seat = row[c];

      if (
        seat.status !== 'FREE' ||
        seat.type === 'BROKEN' ||
        seat.type === 'DISABILITY'
      ) continue;

      // check if this position is already a single gap (filling it is good - removes a gap)
      const leftBooked = c > 0 && row[c - 1].status === 'BOOKED';
      const rightBooked = c < row.length - 1 && row[c + 1].status === 'BOOKED';
      const isExistingGap = leftBooked && rightBooked;

      // simulate placing the solo here
      const { gapsAfter, centerDistance } = simulateBlock(row, c, 1);

      // penalise placing between two groups (not an existing gap but between booked blocks)
      // we check if both sides are booked - this means we are splitting groups
      const placingBetweenGroups = leftBooked && rightBooked && !isExistingGap;
      const penalty = placingBetweenGroups ? 1000 : 0;

      const score = gapsAfter + penalty;

      if (!best || score < best.score || (score === best.score && centerDistance < best.centerDistance)) {
        best = { rowIndex: r, colIndex: c, gapsAfter, score, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.colIndex, 1);
}

// admin override - place anywhere that is free, ignoring all rules except broken
function allocateAdminOverride(cinema, groupSize) {
  const rowOrder = getPreferredRowOrder();

  for (const r of rowOrder) {
    const row = cinema[r];
    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        if (row[c + i].status !== 'FREE' || row[c + i].type === 'BROKEN') {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      return bookBlock(cinema, r, c, groupSize);
    }
  }
  return null;
}

// actually mark seats as booked and return them
function bookBlock(cinema, rowIndex, startColIndex, size) {
  const booked = [];
  for (let i = 0; i < size; i++) {
    const seat = cinema[rowIndex][startColIndex + i];
    seat.status = 'BOOKED';
    booked.push({ ...seat });
  }
  return booked;
}

// main entry point - decide which allocation strategy to use
function allocateSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;

  if (adminOverride) {
    return allocateAdminOverride(cinema, groupSize);
  }

  if (bookingType === 'DISABILITY') {
    return allocateDisability(cinema, groupSize);
  }

  if (bookingType === 'VIP') {
    return allocateVIP(cinema, groupSize);
  }

  if (groupSize === 1) {
    return allocateSolo(cinema);
  }

  return allocateGroup(cinema, groupSize);
}

module.exports = {
  allocateSeats,
  countSingleGaps,
  simulateBlock,
  allocateDisability,
  allocateVIP,
  allocateGroup,
  allocateSolo
};

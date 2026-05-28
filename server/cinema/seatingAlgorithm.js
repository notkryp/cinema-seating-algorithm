// Seating algorithm
// Goal: fill cinema without leaving single scattered empty seats.
// A scattered seat = a FREE seat with BOOKED seats on both sides (impossible to sell as group later).

const { ROWS } = require('./cinemaSetup');

// VIP zone constants - must match cinemaSetup.js
const VIP_ROW_START = 4; // row E
const VIP_ROW_END   = 8; // row I
const VIP_COL_START = 11; // col 12 (0-indexed)
const VIP_COL_END   = 14; // col 15 (0-indexed)

/**
 * Count single isolated FREE seats in a row.
 * A single gap = FREE seat where both neighbours are BOOKED (or wall+BOOKED on one side).
 */
function countSingleGaps(row) {
  let count = 0;
  const n = row.length;
  for (let i = 0; i < n; i++) {
    const seat = row[i];
    if (seat.status !== 'FREE' || seat.status === 'BROKEN') continue;
    const leftBlocked  = i === 0         ? true : row[i - 1].status === 'BOOKED' || row[i - 1].status === 'BROKEN';
    const rightBlocked = i === n - 1     ? true : row[i + 1].status === 'BOOKED' || row[i + 1].status === 'BROKEN';
    if (leftBlocked && rightBlocked) count++;
  }
  return count;
}

/** Simulate placing a block of `groupSize` seats starting at `startColIndex` and return gap count + centre distance. */
function simulateBlock(row, startColIndex, groupSize) {
  const rowCopy = row.map(s => ({ ...s }));
  for (let i = 0; i < groupSize; i++) rowCopy[startColIndex + i].status = 'BOOKED';
  const gapsAfter = countSingleGaps(rowCopy);
  const centerCol  = (row.length - 1) / 2;
  const blockCenter = startColIndex + (groupSize - 1) / 2;
  const centerDistance = Math.abs(blockCenter - centerCol);
  return { gapsAfter, centerDistance };
}

/** Preferred row order: middle rows first (J is roughly centre for 15 rows). */
function getPreferredRowOrder() {
  const indices = ROWS.map((_, i) => i);
  const center  = Math.floor(indices.length / 2);
  return [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

/**
 * Is a given seat in the VIP zone?
 * VIP: rows E-I (index 4-8), cols 12-15 (index 11-14)
 */
function isVIPSeat(rowIndex, colIndex) {
  return rowIndex >= VIP_ROW_START &&
         rowIndex <= VIP_ROW_END   &&
         colIndex >= VIP_COL_START &&
         colIndex <= VIP_COL_END;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR booking: single seat
// Must NOT land on VIP or DISABILITY seats.
// Prefer existing gaps (fills them) over creating new ones.
// ─────────────────────────────────────────────────────────────────────────────
function allocateSolo(cinema) {
  const rowOrder = getPreferredRowOrder();
  let best = null;

  for (const r of rowOrder) {
    const row = cinema[r];
    for (let c = 0; c < row.length; c++) {
      const seat = row[c];
      if (seat.status !== 'FREE' || seat.type === 'BROKEN' || seat.type === 'DISABILITY' || seat.type === 'VIP') continue;

      const leftBlocked  = c > 0             && (row[c - 1].status === 'BOOKED' || row[c - 1].status === 'BROKEN');
      const rightBlocked = c < row.length - 1 && (row[c + 1].status === 'BOOKED' || row[c + 1].status === 'BROKEN');
      const isExistingGap = leftBlocked && rightBlocked;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, 1);
      // Reward filling existing gaps (score = -1), penalise creating new ones
      const score = isExistingGap ? -1 : gapsAfter;

      if (!best || score < best.score || (score === best.score && centerDistance < best.centerDistance)) {
        best = { rowIndex: r, colIndex: c, score, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.colIndex, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR booking: group of 2-7
// Rules:
//   - Must NOT include VIP seats (cols 12-15, rows E-I) or DISABILITY seats
//   - Must NOT include BROKEN seats
//   - The entire block must be contiguous FREE REGULAR seats
//   - Pick the block that creates the fewest single gaps
//   - Tie-break: closest to row centre
// ─────────────────────────────────────────────────────────────────────────────
function allocateGroup(cinema, groupSize) {
  const rowOrder   = getPreferredRowOrder();
  const candidates = [];

  for (const r of rowOrder) {
    const row = cinema[r];

    // Scan every possible start position for a contiguous block of `groupSize`
    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        // Reject if seat is not a free regular seat
        if (
          seat.status !== 'FREE' ||
          seat.type   === 'BROKEN'     ||
          seat.type   === 'DISABILITY' ||
          seat.type   === 'VIP'        // ← KEY FIX: exclude VIP seats from regular group bookings
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

  // Sort: fewest gaps first, then closest to centre
  candidates.sort((a, b) => {
    if (a.gapsAfter !== b.gapsAfter) return a.gapsAfter - b.gapsAfter;
    return a.centerDistance - b.centerDistance;
  });

  const best = candidates[0];
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIP booking
// Rows E-I (index 4-8), columns 12-15 (index 11-14) only.
// ─────────────────────────────────────────────────────────────────────────────
function allocateVIP(cinema, groupSize) {
  const candidates = [];

  for (let r = VIP_ROW_START; r <= VIP_ROW_END; r++) {
    const row = cinema[r];
    for (let c = VIP_COL_START; c <= VIP_COL_END - groupSize + 1; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (seat.type !== 'VIP' || seat.status !== 'FREE') { ok = false; break; }
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

  return bookBlock(cinema, candidates[0].rowIndex, candidates[0].start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISABILITY booking
// Rows A-B only, seat type must be DISABILITY, max group 2.
// ─────────────────────────────────────────────────────────────────────────────
function allocateDisability(cinema, groupSize) {
  const targetRows = [0, 1];
  let best = null;

  for (const r of targetRows) {
    const row = cinema[r];
    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (seat.type !== 'DISABILITY' || seat.status !== 'FREE') { ok = false; break; }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, groupSize);
      if (!best || gapsAfter < best.gapsAfter || (gapsAfter === best.gapsAfter && centerDistance < best.centerDistance)) {
        best = { rowIndex: r, start: c, gapsAfter, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OVERRIDE: place anywhere free (respects BROKEN only)
// ─────────────────────────────────────────────────────────────────────────────
function allocateAdminOverride(cinema, groupSize) {
  const rowOrder = getPreferredRowOrder();
  for (const r of rowOrder) {
    const row = cinema[r];
    for (let c = 0; c <= row.length - groupSize; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        if (row[c + i].status !== 'FREE' || row[c + i].type === 'BROKEN') { ok = false; break; }
      }
      if (ok) return bookBlock(cinema, r, c, groupSize);
    }
  }
  return null;
}

/**
 * PREVIEW: find the best seats WITHOUT booking them.
 * Returns the candidate seats as plain objects (not mutated in the cinema state).
 */
function previewSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;
  const gs = parseInt(groupSize) || 1;

  // We run the same logic on a deep-clone so the real cinema is never touched
  const clone = cinema.map(row => row.map(s => ({ ...s })));
  const booked = allocateSeats(clone, { groupSize: gs, bookingType, adminOverride });
  return booked; // seats that WOULD be booked, from the clone
}

/** Actually mark seats as BOOKED and return copies. */
function bookBlock(cinema, rowIndex, startColIndex, size) {
  const booked = [];
  for (let i = 0; i < size; i++) {
    const seat = cinema[rowIndex][startColIndex + i];
    seat.status = 'BOOKED';
    booked.push({ ...seat });
  }
  return booked;
}

/** Main entry — routes to the right allocator. */
function allocateSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;

  if (adminOverride)           return allocateAdminOverride(cinema, groupSize);
  if (bookingType === 'DISABILITY') return allocateDisability(cinema, groupSize);
  if (bookingType === 'VIP')        return allocateVIP(cinema, groupSize);
  if (groupSize   === 1)            return allocateSolo(cinema);
  return allocateGroup(cinema, groupSize);
}

module.exports = {
  allocateSeats,
  previewSeats,
  countSingleGaps,
  simulateBlock,
  allocateDisability,
  allocateVIP,
  allocateGroup,
  allocateSolo
};

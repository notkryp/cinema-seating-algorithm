// Seating algorithm
// Goal: fill cinema without leaving single scattered empty seats.
// A scattered seat = a FREE seat with BOOKED seats on both sides (impossible to sell as group later).

const { ROWS } = require('./cinemaSetup');

// VIP zone constants - must match cinemaSetup.js
const VIP_ROW_START = 4;  // row E (0-indexed)
const VIP_ROW_END   = 8;  // row I (0-indexed)
const VIP_COL_START = 11; // col 12 (0-indexed)
const VIP_COL_END   = 14; // col 15 (0-indexed)

// ─────────────────────────────────────────────────────────────────────────────
// Gap counting helpers
// ─────────────────────────────────────────────────────────────────────────────

function countSingleGapsInRange(row, fromCol, toCol) {
  let count = 0;
  for (let i = fromCol; i <= toCol; i++) {
    const seat = row[i];
    if (seat.status !== 'FREE' || seat.type === 'BROKEN') continue;

    const leftBlocked = i === fromCol
      ? true
      : (row[i - 1].status === 'BOOKED' || row[i - 1].status === 'BROKEN');

    const rightBlocked = i === toCol
      ? true
      : (row[i + 1].status === 'BOOKED' || row[i + 1].status === 'BROKEN');

    if (leftBlocked && rightBlocked) count++;
  }
  return count;
}

function countSingleGaps(row) {
  return countSingleGapsInRange(row, 0, row.length - 1);
}

function simulateBlockInRange(row, startColIndex, groupSize, fromCol, toCol) {
  const rowCopy = row.map(s => ({ ...s }));
  for (let i = 0; i < groupSize; i++) rowCopy[startColIndex + i].status = 'BOOKED';
  const gapsAfter    = countSingleGapsInRange(rowCopy, fromCol, toCol);
  const rangeCenter  = (fromCol + toCol) / 2;
  const blockCenter  = startColIndex + (groupSize - 1) / 2;
  const centerDistance = Math.abs(blockCenter - rangeCenter);
  return { gapsAfter, centerDistance };
}

function simulateBlock(row, startColIndex, groupSize) {
  return simulateBlockInRange(row, startColIndex, groupSize, 0, row.length - 1);
}

/** Preferred row order: middle rows first. */
function getPreferredRowOrder() {
  const indices = ROWS.map((_, i) => i);
  const center  = Math.floor(indices.length / 2);
  return [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

/**
 * Column scan order: middle-out.
 * For a row of length N, returns col indices starting from the centre,
 * alternating left and right — so recommendations land in the middle first.
 */
function getMiddleOutCols(rowLength) {
  const cols = [];
  const mid  = Math.floor(rowLength / 2);
  cols.push(mid);
  for (let offset = 1; offset <= mid; offset++) {
    if (mid + offset < rowLength) cols.push(mid + offset);
    if (mid - offset >= 0)        cols.push(mid - offset);
  }
  return cols;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR booking: single seat
// Prefer filling existing single gaps; tie-break by distance from row centre.
// Column scan is middle-out so recommendations land in centre seats first.
// ─────────────────────────────────────────────────────────────────────────────
function allocateSolo(cinema) {
  const rowOrder = getPreferredRowOrder();
  let best = null;

  for (const r of rowOrder) {
    const row     = cinema[r];
    const colOrder = getMiddleOutCols(row.length);

    for (const c of colOrder) {
      const seat = row[c];
      if (
        seat.status !== 'FREE' ||
        seat.type === 'BROKEN' ||
        seat.type === 'DISABILITY' ||
        seat.type === 'VIP'
      ) continue;

      const leftBlocked  = c > 0             && (row[c - 1].status === 'BOOKED' || row[c - 1].status === 'BROKEN');
      const rightBlocked = c < row.length - 1 && (row[c + 1].status === 'BOOKED' || row[c + 1].status === 'BROKEN');
      const isExistingGap = leftBlocked && rightBlocked;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, 1);
      const score = isExistingGap ? -1 : gapsAfter;

      if (
        !best ||
        score < best.score ||
        (score === best.score && centerDistance < best.centerDistance)
      ) {
        best = { rowIndex: r, colIndex: c, score, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.colIndex, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR booking: group of 2+
// Fewest new single gaps first; tie-break by distance from row centre.
// Column scan is middle-out so groups land in centre first.
// ─────────────────────────────────────────────────────────────────────────────
function allocateGroup(cinema, groupSize) {
  const rowOrder   = getPreferredRowOrder();
  const candidates = [];

  for (const r of rowOrder) {
    const row      = cinema[r];
    const colOrder = getMiddleOutCols(row.length - groupSize + 1);

    for (const c of colOrder) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const seat = row[c + i];
        if (
          seat.status !== 'FREE' ||
          seat.type === 'BROKEN'     ||
          seat.type === 'DISABILITY' ||
          seat.type === 'VIP'
        ) { ok = false; break; }
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

      const { gapsAfter, centerDistance } = simulateBlockInRange(
        row, c, groupSize, VIP_COL_START, VIP_COL_END
      );

      let isExistingGap = false;
      if (groupSize === 1) {
        const leftBlocked = c === VIP_COL_START
          ? true
          : (row[c - 1].status === 'BOOKED' || row[c - 1].status === 'BROKEN');
        const rightBlocked = c === VIP_COL_END
          ? true
          : (row[c + 1].status === 'BOOKED' || row[c + 1].status === 'BROKEN');
        isExistingGap = leftBlocked && rightBlocked;
      }

      const score = isExistingGap ? -1 : gapsAfter;
      candidates.push({ rowIndex: r, start: c, score, gapsAfter, centerDistance });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.score      !== b.score)      return a.score      - b.score;
    if (a.gapsAfter  !== b.gapsAfter)  return a.gapsAfter  - b.gapsAfter;
    return a.centerDistance - b.centerDistance;
  });

  return bookBlock(cinema, candidates[0].rowIndex, candidates[0].start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISABILITY booking — rows A-B only
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
      if (
        !best ||
        gapsAfter < best.gapsAfter ||
        (gapsAfter === best.gapsAfter && centerDistance < best.centerDistance)
      ) {
        best = { rowIndex: r, start: c, gapsAfter, centerDistance };
      }
    }
  }

  if (!best) return null;
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OVERRIDE: place anywhere free
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

function previewSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;
  const gs    = parseInt(groupSize) || 1;
  const clone = cinema.map(row => row.map(s => ({ ...s })));
  return allocateSeats(clone, { groupSize: gs, bookingType, adminOverride });
}

function bookBlock(cinema, rowIndex, startColIndex, size) {
  const booked = [];
  for (let i = 0; i < size; i++) {
    const seat = cinema[rowIndex][startColIndex + i];
    seat.status = 'BOOKED';
    booked.push({ ...seat });
  }
  return booked;
}

function allocateSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;

  if (adminOverride)                return allocateAdminOverride(cinema, groupSize);
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

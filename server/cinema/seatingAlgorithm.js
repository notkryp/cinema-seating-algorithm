// seatingAlgorithm.js
// Core goal: fill seats without leaving single scattered empty seats.
// A scattered seat = a FREE seat with BOOKED/BROKEN on both sides.
// That kind of gap can never be sold to a pair or group later.

const { ROWS } = require('./cinemaSetup');

// VIP zone boundaries — must stay in sync with cinemaSetup.js
const VIP_ROW_START = 4;  // row E (0-indexed)
const VIP_ROW_END   = 8;  // row I
const VIP_COL_START = 11; // col 12 (0-indexed)
const VIP_COL_END   = 14; // col 15

// ─────────────────────────────────────────────────────────────────────────────
// Gap helpers
// ─────────────────────────────────────────────────────────────────────────────

function countSingleGapsInRange(row, fromCol, toCol) {
  let count = 0;
  for (let i = fromCol; i <= toCol; i++) {
    const seat = row[i];
    if (seat.status !== 'FREE' || seat.type === 'BROKEN') continue;

    const leftBlocked  = i === fromCol
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
  const gapsAfter      = countSingleGapsInRange(rowCopy, fromCol, toCol);
  const rangeCenter    = (fromCol + toCol) / 2;
  const blockCenter    = startColIndex + (groupSize - 1) / 2;
  const centerDistance = Math.abs(blockCenter - rangeCenter);
  return { gapsAfter, centerDistance };
}

function simulateBlock(row, startColIndex, groupSize) {
  return simulateBlockInRange(row, startColIndex, groupSize, 0, row.length - 1);
}

// Preferred row scan order: middle rows first (used for first-row selection).
function getPreferredRowOrder() {
  const indices = ROWS.map((_, i) => i);
  const center  = Math.floor(indices.length / 2);
  return [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

// Column scan order: middle-out so placements land towards the centre first.
function getMiddleOutCols(length) {
  const cols = [];
  const mid  = Math.floor(length / 2);
  cols.push(mid);
  for (let offset = 1; offset <= mid; offset++) {
    if (mid + offset < length) cols.push(mid + offset);
    if (mid - offset >= 0)     cols.push(mid - offset);
  }
  return cols;
}

// ─────────────────────────────────────────────────────────────────────────────
// Largest contiguous FREE REGULAR block in a row
// ─────────────────────────────────────────────────────────────────────────────
function largestContiguousBlock(row) {
  let max = 0, cur = 0;
  for (const seat of row) {
    if (seat.status === 'FREE' && seat.type === 'REGULAR') {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

// ─────────────────────────────────────────────────────────────────────────────
// Best contiguous REGULAR block of exactly `size` in a row.
// Returns { start, gapsAfter, centerDistance } or null.
// ─────────────────────────────────────────────────────────────────────────────
function bestBlockInRow(row, size) {
  const colOrder = getMiddleOutCols(row.length - size + 1);
  let best = null;

  for (const c of colOrder) {
    let ok = true;
    for (let i = 0; i < size; i++) {
      const s = row[c + i];
      if (s.status !== 'FREE' || s.type !== 'REGULAR') { ok = false; break; }
    }
    if (!ok) continue;

    const { gapsAfter, centerDistance } = simulateBlock(row, c, size);
    if (
      !best ||
      gapsAfter < best.gapsAfter ||
      (gapsAfter === best.gapsAfter && centerDistance < best.centerDistance)
    ) {
      best = { start: c, gapsAfter, centerDistance };
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLO booking
// Priority: fewest new gaps → fills existing gap → closest to centre → row
// ─────────────────────────────────────────────────────────────────────────────
function allocateSolo(cinema) {
  const rowOrder   = getPreferredRowOrder();
  const candidates = [];

  for (const r of rowOrder) {
    const row      = cinema[r];
    const colOrder = getMiddleOutCols(row.length);

    for (const c of colOrder) {
      const seat = row[c];
      if (
        seat.status !== 'FREE' ||
        seat.type   === 'BROKEN'     ||
        seat.type   === 'DISABILITY' ||
        seat.type   === 'VIP'
      ) continue;

      const leftBlocked   = c > 0             && (row[c - 1].status === 'BOOKED' || row[c - 1].status === 'BROKEN');
      const rightBlocked  = c < row.length - 1 && (row[c + 1].status === 'BOOKED' || row[c + 1].status === 'BROKEN');
      const isExistingGap = leftBlocked && rightBlocked;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, 1);
      const rowPreference = rowOrder.indexOf(r);

      candidates.push({ rowIndex: r, colIndex: c, gapsAfter, isExistingGap, centerDistance, rowPreference });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.gapsAfter      !== b.gapsAfter)         return a.gapsAfter - b.gapsAfter;
    if (a.isExistingGap  !== b.isExistingGap)     return a.isExistingGap ? -1 : 1;
    if (a.centerDistance !== b.centerDistance)    return a.centerDistance - b.centerDistance;
    return a.rowPreference - b.rowPreference;
  });

  const best = candidates[0];
  return bookBlock(cinema, best.rowIndex, best.colIndex, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP booking — contiguous block in one row
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
        const s = row[c + i];
        if (s.status !== 'FREE' || s.type === 'BROKEN' || s.type === 'DISABILITY' || s.type === 'VIP') {
          ok = false; break;
        }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlock(row, c, groupSize);
      const rowPreference = rowOrder.indexOf(r);
      candidates.push({ rowIndex: r, start: c, gapsAfter, centerDistance, rowPreference });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.gapsAfter      !== b.gapsAfter)      return a.gapsAfter      - b.gapsAfter;
    if (a.centerDistance !== b.centerDistance) return a.centerDistance - b.centerDistance;
    return a.rowPreference - b.rowPreference;
  });

  const best = candidates[0];
  return bookBlock(cinema, best.rowIndex, best.start, groupSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT FALLBACK — used only when no contiguous block exists for the group.
//
// Strategy (Option A — best-fit with anchor proximity):
//   1. Pick the best first row using fewest-gaps + screen-centre scoring.
//   2. Record that row as the ANCHOR.
//   3. For every subsequent sub-group, rank candidate rows by:
//        a. proximity to anchor row  (primary — keeps the group together)
//        b. most people absorbed     (secondary)
//        c. fewest new gaps          (tertiary)
//      This ensures the algorithm always looks at rows directly above/below
//      the anchor before reaching for a distant row.
//   4. Tags every seat with split:true so the API can inform the client.
// ─────────────────────────────────────────────────────────────────────────────
function allocateGroupSplit(cinema, groupSize) {
  const rowOrder  = getPreferredRowOrder();
  let remaining   = groupSize;
  let anchorRow   = null;   // set after first commit
  const allBooked = [];

  while (remaining > 0) {
    const rowScores = [];

    for (const r of rowOrder) {
      const row       = cinema[r];
      const canAbsorb = Math.min(remaining, largestContiguousBlock(row));
      if (canAbsorb === 0) continue;

      const blockResult = bestBlockInRow(row, canAbsorb);
      if (!blockResult) continue;

      // Distance from anchor (or screen centre when anchor not yet set)
      const screenCenter    = Math.floor(rowOrder.length / 2);
      const proximityTarget = anchorRow !== null ? anchorRow : screenCenter;
      const proximityScore  = Math.abs(r - proximityTarget);

      rowScores.push({
        rowIndex:     r,
        canAbsorb,
        gapsAfter:    blockResult.gapsAfter,
        start:        blockResult.start,
        proximityScore
      });
    }

    if (rowScores.length === 0) return null;

    rowScores.sort((a, b) => {
      // After anchor is set: proximity first, then absorb, then gaps
      if (anchorRow !== null) {
        if (a.proximityScore !== b.proximityScore) return a.proximityScore - b.proximityScore;
        if (b.canAbsorb      !== a.canAbsorb)      return b.canAbsorb      - a.canAbsorb;
        return a.gapsAfter - b.gapsAfter;
      }
      // First row: absorb most first, then fewest gaps, then screen centre
      if (b.canAbsorb    !== a.canAbsorb)    return b.canAbsorb    - a.canAbsorb;
      if (a.gapsAfter    !== b.gapsAfter)    return a.gapsAfter    - b.gapsAfter;
      return a.proximityScore - b.proximityScore;
    });

    const chosen = rowScores[0];

    // Set anchor on first commit
    if (anchorRow === null) anchorRow = chosen.rowIndex;

    const booked = bookBlock(cinema, chosen.rowIndex, chosen.start, chosen.canAbsorb);
    allBooked.push(...booked);
    remaining -= chosen.canAbsorb;
  }

  allBooked.forEach(s => { s.split = true; });
  return allBooked;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIP booking — rows E-I, cols 12-15 only
// ─────────────────────────────────────────────────────────────────────────────
function allocateVIP(cinema, groupSize) {
  const candidates = [];

  for (let r = VIP_ROW_START; r <= VIP_ROW_END; r++) {
    const row = cinema[r];

    for (let c = VIP_COL_START; c <= VIP_COL_END - groupSize + 1; c++) {
      let ok = true;
      for (let i = 0; i < groupSize; i++) {
        const s = row[c + i];
        if (s.type !== 'VIP' || s.status !== 'FREE') { ok = false; break; }
      }
      if (!ok) continue;

      const { gapsAfter, centerDistance } = simulateBlockInRange(
        row, c, groupSize, VIP_COL_START, VIP_COL_END
      );

      let isExistingGap = false;
      if (groupSize === 1) {
        const leftBlocked  = c === VIP_COL_START ? true : (row[c - 1].status === 'BOOKED' || row[c - 1].status === 'BROKEN');
        const rightBlocked = c === VIP_COL_END   ? true : (row[c + 1].status === 'BOOKED' || row[c + 1].status === 'BROKEN');
        isExistingGap = leftBlocked && rightBlocked;
      }

      candidates.push({ rowIndex: r, start: c, gapsAfter, isExistingGap, centerDistance });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.gapsAfter     !== b.gapsAfter)         return a.gapsAfter     - b.gapsAfter;
    if (a.isExistingGap !== b.isExistingGap)     return a.isExistingGap ? -1 : 1;
    if (a.centerDistance !== b.centerDistance)   return a.centerDistance - b.centerDistance;
    return a.rowIndex - b.rowIndex;
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
        const s = row[c + i];
        if (s.type !== 'DISABILITY' || s.status !== 'FREE') { ok = false; break; }
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
// ADMIN OVERRIDE — ignores all rules, first free block wins
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

// ─────────────────────────────────────────────────────────────────────────────
// Commit a block to the cinema state and return the booked seats
// ─────────────────────────────────────────────────────────────────────────────
function bookBlock(cinema, rowIndex, startColIndex, size) {
  const booked = [];
  for (let i = 0; i < size; i++) {
    const seat = cinema[rowIndex][startColIndex + i];
    seat.status = 'BOOKED';
    booked.push({ ...seat });
  }
  return booked;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview (non-destructive clone before committing)
// ─────────────────────────────────────────────────────────────────────────────
function previewSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;
  const gs    = parseInt(groupSize) || 1;
  const clone = cinema.map(row => row.map(s => ({ ...s })));
  return allocateSeats(clone, { groupSize: gs, bookingType, adminOverride });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
function allocateSeats(cinema, request) {
  const { groupSize, bookingType, adminOverride } = request;

  if (adminOverride)                return allocateAdminOverride(cinema, groupSize);
  if (bookingType === 'DISABILITY') return allocateDisability(cinema, groupSize);
  if (bookingType === 'VIP')        return allocateVIP(cinema, groupSize);
  if (groupSize   === 1)            return allocateSolo(cinema);

  // Try a clean contiguous block first
  const contiguous = allocateGroup(cinema, groupSize);
  if (contiguous) return contiguous;

  // No single block available — fall back to best-fit row split
  return allocateGroupSplit(cinema, groupSize);
}

module.exports = {
  allocateSeats,
  previewSeats,
  countSingleGaps,
  simulateBlock,
  allocateDisability,
  allocateVIP,
  allocateGroup,
  allocateGroupSplit,
  allocateSolo
};

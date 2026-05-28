// Client-side validation for manual seat picks.
// Mirrors the server-side gap rules so the user gets instant feedback
// before we even hit the API.

const VIP_ROW_START = 4;  // row E
const VIP_ROW_END   = 8;  // row I
const VIP_COL_START = 12; // 1-based col 12
const VIP_COL_END   = 15; // 1-based col 15

export function isVIPSeat(seat) {
  const rowIdx = 'ABCDEFGHIJKLMNO'.indexOf(seat.row);
  return (
    rowIdx >= VIP_ROW_START && rowIdx <= VIP_ROW_END &&
    seat.col >= VIP_COL_START && seat.col <= VIP_COL_END
  );
}

/**
 * Scan a row (array of seat objects) and find all contiguous FREE blocks.
 * Returns an array of block lengths.
 */
function getFreeBlockLengths(row) {
  const blocks = [];
  let cur = 0;
  for (const s of row) {
    if (s.status === 'FREE') {
      cur++;
    } else {
      if (cur > 0) blocks.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) blocks.push(cur);
  return blocks;
}

/**
 * Given the current cinema grid and a proposed set of manual seat IDs,
 * simulate booking those seats and check for gap violations.
 *
 * Returns: { ok: true } or { ok: false, type: 'ONE_GAP'|'TWO_GAP', message, seats }
 */
export function validateManualSelection(cinema, selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return { ok: true };

  const selectedSet = new Set(selectedIds);

  // Simulate the booking on a clone
  const simulated = cinema.map(row =>
    row.map(seat => {
      const id = `${seat.row}${seat.col}`;
      if (selectedSet.has(id) && seat.status === 'FREE') {
        return { ...seat, status: 'BOOKED' };
      }
      return { ...seat };
    })
  );

  let oneGapRows = [];
  let twoGapRows = [];

  for (const row of simulated) {
    const blocks = getFreeBlockLengths(row);
    if (blocks.includes(1)) oneGapRows.push(row[0].row);
    else if (blocks.includes(2)) twoGapRows.push(row[0].row);
  }

  if (oneGapRows.length > 0) {
    return {
      ok: false,
      type: 'ONE_GAP',
      message: `That seat can't be booked — it would trap a single empty seat next to it that nobody can ever fill. Pick a different spot.`,
      rows: oneGapRows
    };
  }

  if (twoGapRows.length > 0) {
    return {
      ok: false,
      type: 'TWO_GAP',
      message: `Just so you know, your pick leaves 2 seats squeezed between bookings. A couple could take them, but if not they'll go to waste. Still want these seats?`,
      rows: twoGapRows
    };
  }

  return { ok: true };
}

/**
 * Check if the user is clicking a seat that conflicts with their booking type.
 * Returns null if fine, or an error message string.
 */
export function checkSeatTypeConflict(seat, bookingType) {
  const vip = isVIPSeat(seat);

  if (bookingType === 'VIP' && !vip) {
    return `That's a regular seat. You're on a VIP booking — pick from the highlighted VIP section (rows E–I).`;
  }
  if (bookingType !== 'VIP' && vip) {
    return `VIP only. Switch your booking type if you want one of these.`;
  }
  if (seat.type === 'DISABILITY' && bookingType !== 'DISABILITY') {
    return `That's an accessible seat — it's reserved for guests who need it.`;
  }
  if (bookingType === 'DISABILITY' && seat.type !== 'DISABILITY') {
    return `Accessible bookings can only use the marked accessible seats (teal, rows A–B).`;
  }
  return null;
}

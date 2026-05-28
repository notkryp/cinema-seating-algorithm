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
 * Scan a row and return info about FREE blocks that are genuinely
 * TRAPPED — i.e. bounded on BOTH sides by a BOOKED or BROKEN seat
 * (not just the row edge).
 *
 * A gap touching the row edge is reachable and never wasted, so
 * we do NOT count those as problematic.
 *
 * Returns { hasOneGap, hasTwoGap }
 */
function getTrappedGaps(row) {
  let hasOneGap = false;
  let hasTwoGap = false;

  const len = row.length;
  let i = 0;

  while (i < len) {
    const seat = row[i];

    // Not a free seat — skip
    if (seat.status !== 'FREE' || seat.type === 'BROKEN') {
      i++;
      continue;
    }

    // Found the start of a FREE run — measure it
    const start = i;
    while (i < len && row[i].status === 'FREE' && row[i].type !== 'BROKEN') i++;
    const end = i - 1; // inclusive
    const blockSize = end - start + 1;

    // Check what's on each side
    const leftIsWall  = start === 0;
    const rightIsWall = end === len - 1;

    const leftIsBooked  = !leftIsWall  && (row[start - 1].status === 'BOOKED' || row[start - 1].type === 'BROKEN');
    const rightIsBooked = !rightIsWall && (row[end   + 1].status === 'BOOKED' || row[end   + 1].type === 'BROKEN');

    // Only flag if BOTH sides are blocked by bookings (truly trapped)
    const trapped = leftIsBooked && rightIsBooked;

    if (trapped) {
      if (blockSize === 1) hasOneGap = true;
      if (blockSize === 2) hasTwoGap = true;
    }
  }

  return { hasOneGap, hasTwoGap };
}

/**
 * Given the current cinema grid and a proposed set of manual seat IDs,
 * simulate booking those seats and check for gap violations.
 *
 * Returns: { ok: true } or { ok: false, type: 'ONE_GAP'|'TWO_GAP', message, rows, isVipZone }
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

  const oneGapRows = [];
  const twoGapRows = [];

  for (const row of simulated) {
    const { hasOneGap, hasTwoGap } = getTrappedGaps(row);
    if (hasOneGap) oneGapRows.push(row[0].row);
    else if (hasTwoGap) twoGapRows.push(row[0].row);
  }

  if (oneGapRows.length > 0) {
    const allVipRows = oneGapRows.every(r => {
      const idx = 'ABCDEFGHIJKLMNO'.indexOf(r);
      return idx >= VIP_ROW_START && idx <= VIP_ROW_END;
    });
    return {
      ok: false,
      type: 'ONE_GAP',
      message: `That seat can't be booked — it would trap a single empty seat next to it that nobody can ever fill. Pick a different spot.`,
      rows: oneGapRows,
      isVipZone: allVipRows
    };
  }

  if (twoGapRows.length > 0) {
    const allVipRows = twoGapRows.every(r => {
      const idx = 'ABCDEFGHIJKLMNO'.indexOf(r);
      return idx >= VIP_ROW_START && idx <= VIP_ROW_END;
    });
    return {
      ok: false,
      type: 'TWO_GAP',
      message: `Just so you know, your pick leaves 2 seats squeezed between bookings. A couple could take them, but if not they'll go to waste. Still want these seats?`,
      rows: twoGapRows,
      isVipZone: allVipRows
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

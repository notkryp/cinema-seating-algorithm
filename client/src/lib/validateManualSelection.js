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
 * Returns a Set of gap signatures for a row in the form "R:start-end".
 * Only includes gaps that are TRULY TRAPPED — bounded on both sides by
 * BOOKED/BROKEN seats (not the row edge, not a DISABILITY/VIP boundary).
 *
 * We treat DISABILITY and VIP type seats as a "zone wall" rather than a
 * blocking booking, because they are never going to be sold to a regular
 * customer and shouldn't trap the first/last regular seat.
 */
function getTrappedGapSignatures(row) {
  const sigs = new Set();
  const len  = row.length;
  let i = 0;

  while (i < len) {
    const seat = row[i];

    if (seat.status !== 'FREE' || seat.type === 'BROKEN' ||
        seat.type === 'DISABILITY' || seat.type === 'VIP') {
      i++;
      continue;
    }

    const start = i;
    while (
      i < len &&
      row[i].status === 'FREE' &&
      row[i].type !== 'BROKEN' &&
      row[i].type !== 'DISABILITY' &&
      row[i].type !== 'VIP'
    ) i++;
    const end       = i - 1;
    const blockSize = end - start + 1;

    // Left boundary: row edge OR a non-REGULAR type seat acts as a wall
    const leftIsWall = start === 0 ||
      row[start - 1].type === 'DISABILITY' ||
      row[start - 1].type === 'VIP';

    // Right boundary: row edge OR a non-REGULAR type seat acts as a wall
    const rightIsWall = end === len - 1 ||
      row[end + 1].type === 'DISABILITY' ||
      row[end + 1].type === 'VIP';

    const leftBlocked  = !leftIsWall  && (row[start - 1].status === 'BOOKED' || row[start - 1].type === 'BROKEN');
    const rightBlocked = !rightIsWall && (row[end   + 1].status === 'BOOKED' || row[end   + 1].type === 'BROKEN');

    if (leftBlocked && rightBlocked && (blockSize === 1 || blockSize === 2)) {
      sigs.add(`${row[0].row}:${start}-${end}`);
    }
  }

  return sigs;
}

/**
 * Given the current cinema grid and a proposed set of manual seat IDs,
 * simulate booking those seats and check whether the selection INTRODUCES
 * any new gap that wasn't already there before.
 *
 * Key fix: we diff gap signatures BEFORE vs AFTER the simulation.
 * Pre-existing gaps are completely ignored — we only care about gaps
 * the user's click actually creates.
 *
 * Returns: { ok: true } or { ok: false, type: 'ONE_GAP'|'TWO_GAP', message, rows, isVipZone }
 */
export function validateManualSelection(cinema, selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return { ok: true };

  const selectedSet = new Set(selectedIds);

  // Gaps in the current state (before this selection)
  const beforeGaps = new Map(); // rowLabel -> Set of gap sigs
  for (const row of cinema) {
    beforeGaps.set(row[0].row, getTrappedGapSignatures(row));
  }

  // Simulate the booking
  const simulated = cinema.map(row =>
    row.map(seat => {
      const id = `${seat.row}${seat.col}`;
      return selectedSet.has(id) && seat.status === 'FREE'
        ? { ...seat, status: 'BOOKED' }
        : { ...seat };
    })
  );

  // Gaps after simulation
  const oneGapRows = [];
  const twoGapRows = [];

  for (const row of simulated) {
    const label      = row[0].row;
    const afterSigs  = getTrappedGapSignatures(row);
    const beforeSigs = beforeGaps.get(label) || new Set();

    // Only care about gaps that are NEW (didn't exist before this selection)
    let newOneGap = false;
    let newTwoGap = false;

    for (const sig of afterSigs) {
      if (beforeSigs.has(sig)) continue; // pre-existing, ignore
      const [, range] = sig.split(':');
      const [s, e]    = range.split('-').map(Number);
      const size      = e - s + 1;
      if (size === 1) newOneGap = true;
      if (size === 2) newTwoGap = true;
    }

    if (newOneGap) oneGapRows.push(label);
    else if (newTwoGap) twoGapRows.push(label);
  }

  if (oneGapRows.length > 0) {
    const allVip = oneGapRows.every(r => {
      const idx = 'ABCDEFGHIJKLMNO'.indexOf(r);
      return idx >= VIP_ROW_START && idx <= VIP_ROW_END;
    });
    return {
      ok: false,
      type: 'ONE_GAP',
      message: `That selection would trap a single empty seat that can never be sold. Pick a different spot.`,
      rows: oneGapRows,
      isVipZone: allVip
    };
  }

  if (twoGapRows.length > 0) {
    const allVip = twoGapRows.every(r => {
      const idx = 'ABCDEFGHIJKLMNO'.indexOf(r);
      return idx >= VIP_ROW_START && idx <= VIP_ROW_END;
    });
    return {
      ok: false,
      type: 'TWO_GAP',
      message: `Heads up — your selection leaves 2 seats squeezed between bookings. A couple could fill them, but if not they'll go to waste. Still want these seats?`,
      rows: twoGapRows,
      isVipZone: allVip
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

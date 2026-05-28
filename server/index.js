const express = require('express');
const cors    = require('cors');
const { createCinema }  = require('./cinema/cinemaSetup');
const { allocateSeats, previewSeats } = require('./cinema/seatingAlgorithm');

const app = express();
app.use(cors());
app.use(express.json());

// ─── In-memory state ──────────────────────────────────────────────────────────
let cinema         = createCinema();
let bookings       = [];
let bookingCounter = 0;

function nextRef() {
  bookingCounter++;
  return `BK-${String(bookingCounter).padStart(5, '0')}`;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_TYPES = ['NORMAL', 'VIP', 'DISABILITY'];

const GROUP_LIMITS = {
  DISABILITY: { min: 1, max: 2 },
  VIP:        { min: 1, max: 7 },
  NORMAL:     { min: 1, max: 7 }
};

function validateGroupSize(groupSize, bookingType) {
  const type   = bookingType || 'NORMAL';
  const limits = GROUP_LIMITS[type];
  if (!limits) return 'Unrecognised booking type';
  if (groupSize < limits.min || groupSize > limits.max) {
    return `Group size for ${type} bookings must be between ${limits.min} and ${limits.max}`;
  }
  return null;
}

function rowHasTrappedSingleGap(row) {
  const len = row.length;
  let i = 0;

  while (i < len) {
    const seat = row[i];
    if (seat.status !== 'FREE' || seat.type === 'BROKEN') { i++; continue; }

    const start = i;
    while (i < len && row[i].status === 'FREE' && row[i].type !== 'BROKEN') i++;
    const end       = i - 1;
    const blockSize = end - start + 1;

    const leftBlocked  = start > 0       && (row[start - 1].status === 'BOOKED' || row[start - 1].type === 'BROKEN');
    const rightBlocked = end   < len - 1 && (row[end   + 1].status === 'BOOKED' || row[end   + 1].type === 'BROKEN');

    if (leftBlocked && rightBlocked && blockSize === 1) return true;
  }
  return false;
}

// ── GET /api/cinema ───────────────────────────────────────────────────────────
app.get('/api/cinema', (req, res) => {
  res.json({ cinema });
});

// ── GET /api/bookings ─────────────────────────────────────────────────────────
app.get('/api/bookings', (req, res) => {
  res.json({ bookings });
});

// ── POST /api/cinema/reset ────────────────────────────────────────────────────
app.post('/api/cinema/reset', (req, res) => {
  cinema         = createCinema();
  bookings       = [];
  bookingCounter = 0;
  res.json({ message: 'Session reset — fresh cinema loaded', cinema, bookings });
});

// ── POST /api/book/preview ────────────────────────────────────────────────────
app.post('/api/book/preview', (req, res) => {
  const { groupSize, bookingType, adminOverride } = req.body;
  const gs   = parseInt(groupSize);
  const type = bookingType || 'NORMAL';

  if (!gs || isNaN(gs))
    return res.status(400).json({ error: 'groupSize is required and must be a number' });
  if (!VALID_TYPES.includes(type))
    return res.status(400).json({ error: `Booking type '${type}' is not recognised` });

  const sizeErr = validateGroupSize(gs, type);
  if (sizeErr) return res.status(400).json({ error: sizeErr });

  const seats = previewSeats(cinema, { groupSize: gs, bookingType: type, adminOverride: adminOverride || false });
  if (!seats || seats.length === 0)
    return res.status(409).json({ error: 'No seats available for this request' });

  const isSplit = seats.some(s => s.split);
  res.json({ seats, cinema, split: isSplit });
});

// ── POST /api/book ────────────────────────────────────────────────────────────
app.post('/api/book', (req, res) => {
  const { groupSize, bookingType, adminOverride, movie, customerName } = req.body;
  const gs   = parseInt(groupSize);
  const type = bookingType || 'NORMAL';

  if (!gs || isNaN(gs))
    return res.status(400).json({ error: 'groupSize is required and must be a number' });
  if (!VALID_TYPES.includes(type))
    return res.status(400).json({ error: `Booking type '${type}' is not recognised` });

  const sizeErr = validateGroupSize(gs, type);
  if (sizeErr) return res.status(400).json({ error: sizeErr });

  const allocated = allocateSeats(cinema, { groupSize: gs, bookingType: type, adminOverride: adminOverride || false });
  if (!allocated || allocated.length === 0)
    return res.status(409).json({ error: 'No seats available for this request' });

  const isSplit = allocated.some(s => s.split);

  const booking = {
    ref:          nextRef(),
    customerName: customerName || 'Guest',
    movie:        movie || 'N/A',
    bookingType:  type,
    groupSize:    gs,
    seats:        allocated.map(s => `${s.row}${s.col}`),
    bookedAt:     new Date().toISOString(),
    status:       'CONFIRMED',
    method:       'ALGORITHM',
    split:        isSplit
  };
  bookings.push(booking);
  res.json({
    booking,
    cinema,
    split: isSplit,
    splitNote: isSplit
      ? 'No single row had enough space — your group has been split across rows.'
      : undefined
  });
});

// ── POST /api/book/manual ─────────────────────────────────────────────────────
app.post('/api/book/manual', (req, res) => {
  const { seats: seatIds, bookingType, movie, customerName } = req.body;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0)
    return res.status(400).json({ error: 'No seats provided — pass an array of seat IDs' });

  const type = bookingType || 'NORMAL';
  if (!VALID_TYPES.includes(type))
    return res.status(400).json({ error: `Booking type '${type}' is not recognised` });

  const sizeErr = validateGroupSize(seatIds.length, type);
  if (sizeErr) return res.status(400).json({ error: sizeErr });

  const toBook = [];
  for (const rowArr of cinema) {
    for (const seat of rowArr) {
      const id = `${seat.row}${seat.col}`;
      if (seatIds.includes(id)) {
        if (seat.status !== 'FREE')
          return res.status(409).json({ error: `Seat ${id} is no longer available` });
        toBook.push(seat);
      }
    }
  }
  if (toBook.length !== seatIds.length)
    return res.status(400).json({ error: "One or more seat IDs don't exist in this cinema" });

  const sim = cinema.map(row => row.map(s => ({ ...s })));
  for (const rowArr of sim)
    for (const s of rowArr)
      if (seatIds.includes(`${s.row}${s.col}`)) s.status = 'BOOKED';

  const gapRows = [];
  for (const row of sim)
    if (rowHasTrappedSingleGap(row)) gapRows.push(row[0].row);

  if (gapRows.length > 0) {
    return res.status(422).json({
      error: `Booking these seats would leave a single empty seat trapped between bookings — it could never be sold. Try a different position.`,
      rows: gapRows
    });
  }

  for (const rowArr of cinema)
    for (const s of rowArr)
      if (seatIds.includes(`${s.row}${s.col}`)) s.status = 'BOOKED';

  const booking = {
    ref:          nextRef(),
    customerName: customerName || 'Guest',
    movie:        movie || 'N/A',
    bookingType:  type,
    groupSize:    seatIds.length,
    seats:        seatIds,
    bookedAt:     new Date().toISOString(),
    status:       'CONFIRMED',
    method:       'MANUAL'
  };
  bookings.push(booking);
  res.json({ booking, cinema });
});

// ── POST /api/admin/move ──────────────────────────────────────────────────────
// No constraints — admin can move any confirmed booking to any free seats.
// The old seats are freed, the new seats are booked, booking record is updated.
app.post('/api/admin/move', (req, res) => {
  const { ref, newSeats } = req.body;

  if (!ref)
    return res.status(400).json({ error: 'ref is required' });
  if (!newSeats || !Array.isArray(newSeats) || newSeats.length === 0)
    return res.status(400).json({ error: 'newSeats must be a non-empty array of seat IDs' });

  const booking = bookings.find(b => b.ref === ref && b.status === 'CONFIRMED');
  if (!booking)
    return res.status(404).json({ error: `Booking ${ref} not found or already cancelled` });

  if (newSeats.length !== booking.groupSize)
    return res.status(400).json({
      error: `This booking has ${booking.groupSize} seat${booking.groupSize > 1 ? 's' : ''} — provide exactly that many new seats`
    });

  // Verify new seats exist and are free (or are the current booking's own seats)
  const currentSeatSet = new Set(booking.seats);
  for (const id of newSeats) {
    let found = false;
    for (const rowArr of cinema) {
      for (const seat of rowArr) {
        if (`${seat.row}${seat.col}` === id) {
          found = true;
          if (seat.status !== 'FREE' && !currentSeatSet.has(id))
            return res.status(409).json({ error: `Seat ${id} is not available` });
        }
      }
    }
    if (!found)
      return res.status(400).json({ error: `Seat ${id} does not exist` });
  }

  // Free the old seats
  for (const rowArr of cinema)
    for (const seat of rowArr)
      if (currentSeatSet.has(`${seat.row}${seat.col}`)) seat.status = 'FREE';

  // Book the new seats (no gap/type/zone checks — admin override)
  for (const rowArr of cinema)
    for (const seat of rowArr)
      if (newSeats.includes(`${seat.row}${seat.col}`)) seat.status = 'BOOKED';

  // Update booking record
  booking.seats    = newSeats;
  booking.movedAt  = new Date().toISOString();
  booking.method   = booking.method === 'ALGORITHM' ? 'ALGORITHM+ADMIN_MOVE' : 'MANUAL+ADMIN_MOVE';

  res.json({ booking, cinema });
});

// ── POST /api/cancel ──────────────────────────────────────────────────────────
app.post('/api/cancel', (req, res) => {
  const { ref, seats } = req.body;

  if (ref) {
    const idx = bookings.findIndex(b => b.ref === ref && b.status === 'CONFIRMED');
    if (idx === -1)
      return res.status(404).json({ error: `Booking ${ref} not found or already cancelled` });
    const booking = bookings[idx];
    for (const rowArr of cinema)
      for (const s of rowArr)
        if (booking.seats.includes(`${s.row}${s.col}`) && s.status === 'BOOKED') s.status = 'FREE';
    booking.status      = 'CANCELLED';
    booking.cancelledAt = new Date().toISOString();
    return res.json({ message: `${ref} cancelled — ${booking.seats.length} seat(s) freed`, booking, cinema });
  }

  if (seats && Array.isArray(seats)) {
    let freed = 0;
    for (const rowArr of cinema)
      for (const s of rowArr)
        if (seats.includes(`${s.row}${s.col}`) && s.status === 'BOOKED') { s.status = 'FREE'; freed++; }
    for (const b of bookings)
      if (b.status === 'CONFIRMED' && b.seats.every(s => seats.includes(s))) {
        b.status = 'CANCELLED'; b.cancelledAt = new Date().toISOString();
      }
    return res.json({ message: `${freed} seat(s) freed`, cinema });
  }

  res.status(400).json({ error: 'Send either a booking ref or an array of seat IDs' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cinema API running on :${PORT}`));

module.exports = app;

const express = require('express');
const cors    = require('cors');
const { createCinema }  = require('./cinema/cinemaSetup');
const { allocateSeats, previewSeats } = require('./cinema/seatingAlgorithm');

const app = express();
app.use(cors());
app.use(express.json());

// ─── In-memory state ──────────────────────────────────────────────────────────
let cinema   = createCinema();
let bookings = [];
let bookingCounter = 0;

function nextRef() {
  bookingCounter++;
  return `BK-${String(bookingCounter).padStart(5, '0')}`;
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
  cinema   = createCinema();
  bookings = [];
  res.json({ message: 'Session reset — fresh cinema loaded', cinema, bookings });
});

// ── POST /api/book/preview ────────────────────────────────────────────────────
app.post('/api/book/preview', (req, res) => {
  const { groupSize, bookingType, adminOverride } = req.body;
  if (!groupSize || groupSize < 1 || groupSize > 28)
    return res.status(400).json({ error: 'Group size has to be between 1 and 28' });
  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'That booking type is not recognised' });
  const seats = previewSeats(cinema, {
    groupSize:     parseInt(groupSize),
    bookingType:   bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });
  if (!seats || seats.length === 0)
    return res.status(409).json({ error: 'No seats available that fit this request' });
  res.json({ seats, cinema });
});

// ── POST /api/book ────────────────────────────────────────────────────────────
// Algorithm-recommended booking
app.post('/api/book', (req, res) => {
  const { groupSize, bookingType, adminOverride, movie, customerName } = req.body;
  if (!groupSize || groupSize < 1 || groupSize > 28)
    return res.status(400).json({ error: 'Group size has to be between 1 and 28' });
  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'That booking type is not recognised' });

  const allocated = allocateSeats(cinema, {
    groupSize:     parseInt(groupSize),
    bookingType:   bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });
  if (!allocated || allocated.length === 0)
    return res.status(409).json({ error: 'No seats available that fit this request' });

  const booking = {
    ref:          nextRef(),
    customerName: customerName || 'Guest',
    movie:        movie || 'N/A',
    bookingType:  bookingType || 'NORMAL',
    groupSize:    parseInt(groupSize),
    seats:        allocated.map(s => `${s.row}${s.col}`),
    bookedAt:     new Date().toISOString(),
    status:       'CONFIRMED',
    method:       'ALGORITHM'
  };
  bookings.push(booking);
  res.json({ booking, cinema });
});

// ── POST /api/book/manual ─────────────────────────────────────────────────────
// User manually picked seats — validate then commit
app.post('/api/book/manual', (req, res) => {
  const { seats: seatIds, bookingType, movie, customerName } = req.body;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0)
    return res.status(400).json({ error: 'No seats were sent — please pass an array of seat IDs' });

  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'That booking type is not recognised' });

  // 1. Check all seats are still free
  const toBook = [];
  for (const rowArr of cinema) {
    for (const seat of rowArr) {
      const id = `${seat.row}${seat.col}`;
      if (seatIds.includes(id)) {
        if (seat.status !== 'FREE')
          return res.status(409).json({ error: `Seat ${id} is already taken — try a different one` });
        toBook.push(seat);
      }
    }
  }

  if (toBook.length !== seatIds.length)
    return res.status(400).json({ error: "One or more of those seats don't exist in this cinema" });

  // 2. Simulate booking and check for single-seat gaps
  const simulated = cinema.map(row => row.map(s => ({ ...s })));
  for (const rowArr of simulated)
    for (const seat of rowArr)
      if (seatIds.includes(`${seat.row}${seat.col}`)) seat.status = 'BOOKED';

  const oneGapRows = [];
  for (const row of simulated) {
    let cur = 0;
    let found1 = false;
    for (const s of row) {
      if (s.status === 'FREE' && s.type !== 'BROKEN') { cur++; }
      else { if (cur === 1) found1 = true; cur = 0; }
    }
    if (cur === 1) found1 = true;
    if (found1) oneGapRows.push(row[0].row);
  }

  if (oneGapRows.length > 0) {
    return res.status(422).json({
      error: `Can't book those seats — it would leave a single empty seat stuck between bookings that nobody can use. Try picking a different spot.`,
      rows: oneGapRows
    });
  }

  // 3. Commit
  for (const rowArr of cinema)
    for (const seat of rowArr)
      if (seatIds.includes(`${seat.row}${seat.col}`)) seat.status = 'BOOKED';

  const booking = {
    ref:          nextRef(),
    customerName: customerName || 'Guest',
    movie:        movie || 'N/A',
    bookingType:  bookingType || 'NORMAL',
    groupSize:    seatIds.length,
    seats:        seatIds,
    bookedAt:     new Date().toISOString(),
    status:       'CONFIRMED',
    method:       'MANUAL'
  };
  bookings.push(booking);
  res.json({ booking, cinema });
});

// ── POST /api/cancel ──────────────────────────────────────────────────────────
app.post('/api/cancel', (req, res) => {
  const { ref, seats } = req.body;

  if (ref) {
    const idx = bookings.findIndex(b => b.ref === ref && b.status === 'CONFIRMED');
    if (idx === -1)
      return res.status(404).json({ error: `Couldn't find booking ${ref} — it may already be cancelled` });
    const booking = bookings[idx];
    for (const rowArr of cinema)
      for (const seat of rowArr)
        if (booking.seats.includes(`${seat.row}${seat.col}`) && seat.status === 'BOOKED')
          seat.status = 'FREE';
    booking.status      = 'CANCELLED';
    booking.cancelledAt = new Date().toISOString();
    return res.json({ message: `${ref} cancelled — ${booking.seats.length} seat(s) freed up`, booking, cinema });
  }

  if (seats && Array.isArray(seats)) {
    let cancelled = 0;
    for (const rowArr of cinema)
      for (const seat of rowArr)
        if (seats.includes(`${seat.row}${seat.col}`) && seat.status === 'BOOKED') {
          seat.status = 'FREE'; cancelled++;
        }
    for (const b of bookings)
      if (b.status === 'CONFIRMED' && b.seats.every(s => seats.includes(s))) {
        b.status = 'CANCELLED'; b.cancelledAt = new Date().toISOString();
      }
    return res.json({ message: `${cancelled} seat(s) freed up`, cinema });
  }

  res.status(400).json({ error: 'Send either a booking ref or a list of seat IDs' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cinema seating server running on port ${PORT}`));

module.exports = app;

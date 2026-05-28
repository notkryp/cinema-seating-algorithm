const express = require('express');
const cors    = require('cors');
const { createCinema }  = require('./cinema/cinemaSetup');
const { allocateSeats, previewSeats } = require('./cinema/seatingAlgorithm');

const app = express();
app.use(cors());
app.use(express.json());

// ─── In-memory state ─────────────────────────────────────────────────────────
let cinema   = createCinema();
let bookings = [];          // persists across requests, wiped on reset
let bookingCounter = 0;     // increments forever, never resets (unique refs)

function nextRef() {
  bookingCounter++;
  return `BK-${String(bookingCounter).padStart(5, '0')}`;
}

// ── GET /api/cinema ──────────────────────────────────────────────────────────
app.get('/api/cinema', (req, res) => {
  res.json({ cinema });
});

// ── GET /api/bookings ────────────────────────────────────────────────────────
// Return full booking history for the current session.
app.get('/api/bookings', (req, res) => {
  res.json({ bookings });
});

// ── POST /api/cinema/reset ───────────────────────────────────────────────────
// Wipe cinema AND booking history, generate fresh layout.
app.post('/api/cinema/reset', (req, res) => {
  cinema   = createCinema();
  bookings = [];
  res.json({ message: 'Cinema reset for new session', cinema, bookings });
});

// ── POST /api/book/preview ───────────────────────────────────────────────────
// DRY-RUN: find which seats WOULD be allocated without committing.
app.post('/api/book/preview', (req, res) => {
  const { groupSize, bookingType, adminOverride } = req.body;

  if (!groupSize || groupSize < 1 || groupSize > 28)
    return res.status(400).json({ error: 'Group size must be between 1 and 28' });

  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'Invalid booking type' });

  const seats = previewSeats(cinema, {
    groupSize:     parseInt(groupSize),
    bookingType:   bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });

  if (!seats || seats.length === 0)
    return res.status(409).json({ error: 'No suitable seats found for this booking' });

  res.json({ seats, cinema });
});

// ── POST /api/book ───────────────────────────────────────────────────────────
// COMMIT: allocate seats, persist booking record to in-memory store.
app.post('/api/book', (req, res) => {
  const { groupSize, bookingType, adminOverride, movie, customerName } = req.body;

  if (!groupSize || groupSize < 1 || groupSize > 28)
    return res.status(400).json({ error: 'Group size must be between 1 and 28' });

  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'Invalid booking type' });

  const allocatedSeats = allocateSeats(cinema, {
    groupSize:     parseInt(groupSize),
    bookingType:   bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });

  if (!allocatedSeats || allocatedSeats.length === 0)
    return res.status(409).json({ error: 'No suitable seats found for this booking' });

  // Build and store the booking record
  const booking = {
    ref:          nextRef(),
    customerName: customerName || 'Guest',
    movie:        movie || 'N/A',
    bookingType:  bookingType || 'NORMAL',
    groupSize:    parseInt(groupSize),
    seats:        allocatedSeats.map(s => `${s.row}${s.col}`),
    bookedAt:     new Date().toISOString(),
    status:       'CONFIRMED'
  };

  bookings.push(booking);

  res.json({ booking, cinema });
});

// ── POST /api/cancel ─────────────────────────────────────────────────────────
// Cancel by booking reference (e.g. { "ref": "BK-00003" })
// Also supports legacy raw seat array { "seats": ["A1","A2"] }
app.post('/api/cancel', (req, res) => {
  const { ref, seats } = req.body;

  // --- Cancel by booking reference (preferred) ---
  if (ref) {
    const idx = bookings.findIndex(b => b.ref === ref && b.status === 'CONFIRMED');
    if (idx === -1)
      return res.status(404).json({ error: `Booking ${ref} not found or already cancelled` });

    const booking = bookings[idx];
    // Free the seats in the cinema grid
    for (const rowArr of cinema)
      for (const seat of rowArr)
        if (booking.seats.includes(`${seat.row}${seat.col}`) && seat.status === 'BOOKED')
          seat.status = 'FREE';

    booking.status     = 'CANCELLED';
    booking.cancelledAt = new Date().toISOString();

    return res.json({
      message:  `Booking ${ref} cancelled — ${booking.seats.length} seat(s) freed`,
      booking,
      cinema
    });
  }

  // --- Legacy: cancel by raw seat IDs ---
  if (seats && Array.isArray(seats)) {
    let cancelled = 0;
    for (const rowArr of cinema)
      for (const seat of rowArr)
        if (seats.includes(`${seat.row}${seat.col}`) && seat.status === 'BOOKED') {
          seat.status = 'FREE';
          cancelled++;
        }

    // Mark any matching confirmed bookings as cancelled
    for (const b of bookings) {
      if (b.status === 'CONFIRMED' && b.seats.every(s => seats.includes(s))) {
        b.status      = 'CANCELLED';
        b.cancelledAt = new Date().toISOString();
      }
    }

    return res.json({ message: `Cancelled ${cancelled} seat(s)`, cinema });
  }

  res.status(400).json({ error: 'Provide either a booking ref or an array of seat IDs' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cinema seating server running on port ${PORT}`));

module.exports = app;

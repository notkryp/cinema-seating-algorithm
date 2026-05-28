const express = require('express');
const cors    = require('cors');
const { createCinema }  = require('./cinema/cinemaSetup');
const { allocateSeats, previewSeats } = require('./cinema/seatingAlgorithm');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory cinema state for the current session
let cinema = createCinema();

// ── GET /api/cinema ──────────────────────────────────────────────────────────
// Return the full cinema grid (seat types, statuses)
app.get('/api/cinema', (req, res) => {
  res.json({ cinema });
});

// ── POST /api/cinema/reset ───────────────────────────────────────────────────
// Start a brand-new session (new broken & disability positions)
app.post('/api/cinema/reset', (req, res) => {
  cinema = createCinema();
  res.json({ message: 'Cinema reset for new session', cinema });
});

// ── POST /api/book/preview ───────────────────────────────────────────────────
// DRY-RUN: find which seats WOULD be allocated, without committing.
// Used by the frontend to show Screen 3 before the user confirms.
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

  // Return the preview seats. Cinema state is NOT mutated.
  res.json({ seats, cinema });
});

// ── POST /api/book ───────────────────────────────────────────────────────────
// COMMIT: actually book the seats and persist to in-memory state.
app.post('/api/book', (req, res) => {
  const { groupSize, bookingType, adminOverride } = req.body;

  if (!groupSize || groupSize < 1 || groupSize > 28)
    return res.status(400).json({ error: 'Group size must be between 1 and 28' });

  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType))
    return res.status(400).json({ error: 'Invalid booking type' });

  const result = allocateSeats(cinema, {
    groupSize:     parseInt(groupSize),
    bookingType:   bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });

  if (!result)
    return res.status(409).json({ error: 'No suitable seats found for this booking' });

  res.json({ booked: result, cinema });
});

// ── POST /api/cancel ─────────────────────────────────────────────────────────
// Cancel specific seats by their ID (e.g. ["A1", "A2"])
app.post('/api/cancel', (req, res) => {
  const { seats } = req.body;
  if (!seats || !Array.isArray(seats))
    return res.status(400).json({ error: 'Provide an array of seat IDs to cancel' });

  let cancelled = 0;
  for (const rowArr of cinema)
    for (const seat of rowArr)
      if (seats.includes(`${seat.row}${seat.col}`) && seat.status === 'BOOKED') {
        seat.status = 'FREE';
        cancelled++;
      }

  res.json({ message: `Cancelled ${cancelled} seat(s)`, cinema });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cinema seating server running on port ${PORT}`));

module.exports = app;

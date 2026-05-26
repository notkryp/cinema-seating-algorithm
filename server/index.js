const express = require('express');
const cors = require('cors');
const { createCinema } = require('./cinema/cinemaSetup');
const { allocateSeats } = require('./cinema/seatingAlgorithm');

const app = express();
app.use(cors());
app.use(express.json());

// keep the cinema state in memory
let cinema = createCinema();

// get the full cinema state
app.get('/api/cinema', (req, res) => {
  res.json({ cinema });
});

// reset the cinema (new session)
app.post('/api/cinema/reset', (req, res) => {
  cinema = createCinema();
  res.json({ message: 'Cinema reset for new session', cinema });
});

// book seats
app.post('/api/book', (req, res) => {
  const { groupSize, bookingType, adminOverride } = req.body;

  if (!groupSize || groupSize < 1 || groupSize > 28) {
    return res.status(400).json({ error: 'Group size must be between 1 and 28' });
  }

  const validTypes = ['NORMAL', 'VIP', 'DISABILITY'];
  if (bookingType && !validTypes.includes(bookingType)) {
    return res.status(400).json({ error: 'Invalid booking type' });
  }

  const result = allocateSeats(cinema, {
    groupSize: parseInt(groupSize),
    bookingType: bookingType || 'NORMAL',
    adminOverride: adminOverride || false
  });

  if (!result) {
    return res.status(409).json({ error: 'No suitable seats found for this booking' });
  }

  res.json({ booked: result, cinema });
});

// cancel a booking by seat IDs
app.post('/api/cancel', (req, res) => {
  const { seats } = req.body;
  if (!seats || !Array.isArray(seats)) {
    return res.status(400).json({ error: 'Provide an array of seat IDs to cancel' });
  }

  let cancelled = 0;
  for (const rowArr of cinema) {
    for (const seat of rowArr) {
      const seatId = `${seat.row}${seat.col}`;
      if (seats.includes(seatId) && seat.status === 'BOOKED') {
        seat.status = 'FREE';
        cancelled++;
      }
    }
  }

  res.json({ message: `Cancelled ${cancelled} seat(s)`, cinema });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Cinema seating server running on port ${PORT}`);
});

module.exports = app;

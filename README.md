# Cinema Seating Algorithm

## What it does

- Shows a cinema with 15 rows (A to O) and 28 seats per row
- Has VIP seats in rows E to I, columns 12 to 15
- Has 6 disability seats always in rows A or B, always next to each other
- Randomly breaks between 6 and 10 seats each session (max 2 per row, never next to each other)
- Books groups of 2 to 7 people together in the same row
- Avoids leaving single empty seats between booked groups
- Solo customers go to row ends, not between groups
- Admin can override all rules if needed

## Tech used

- React (frontend - seating grid)
- Node.js + Express (backend - algorithm logic)
- Jest (tests - TDD approach)

## How to run

### Backend
```
cd server
npm install
npm start
```

### Frontend
```
cd client
npm install
npm start
```

### Tests
```
cd server
npm test
```

## Project layout

```
client/     - React app showing the seat grid
server/     - Node/Express API with the seating algorithm
```

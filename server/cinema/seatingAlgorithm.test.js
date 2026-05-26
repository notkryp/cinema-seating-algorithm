// tests for the seating algorithm
// written before coding (TDD) - these check the core logic works

const { createCinema } = require('./cinemaSetup');
const {
  allocateSeats,
  countSingleGaps,
  allocateDisability,
  allocateVIP,
  allocateGroup,
  allocateSolo
} = require('./seatingAlgorithm');

// helper to make a fake row quickly for testing gaps
function makeRow(pattern) {
  // pattern is a string like 'BBBFF BB' where B=BOOKED F=FREE X=BROKEN
  return pattern.split('').map((ch, i) => ({
    row: 'A',
    col: i + 1,
    type: ch === 'X' ? 'BROKEN' : 'REGULAR',
    status: ch === 'B' ? 'BOOKED' : ch === 'X' ? 'BROKEN' : 'FREE'
  }));
}

describe('countSingleGaps', () => {
  test('no gaps when row is empty', () => {
    const row = makeRow('FFFFFFFF');
    expect(countSingleGaps(row)).toBe(0);
  });

  test('detects one single gap between two booked seats', () => {
    // B F B - the middle free seat is a gap
    const row = makeRow('BFB');
    expect(countSingleGaps(row)).toBe(1);
  });

  test('does not count two adjacent free seats as a gap', () => {
    const row = makeRow('BFFB');
    expect(countSingleGaps(row)).toBe(0);
  });

  test('broken seats do not count as gaps', () => {
    const row = makeRow('BXB');
    expect(countSingleGaps(row)).toBe(0);
  });

  test('counts multiple gaps correctly', () => {
    // B F B F B = 2 gaps
    const row = makeRow('BFBFB');
    expect(countSingleGaps(row)).toBe(2);
  });
});

describe('allocateDisability', () => {
  test('books seats only in row A or B', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    expect(['A', 'B']).toContain(result[0].row);
  });

  test('only books seats of type DISABILITY', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(seat => {
      expect(seat.type).toBe('DISABILITY');
    });
  });

  test('books seats next to each other', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    expect(result[1].col - result[0].col).toBe(1);
  });

  test('returns null when all disability seats are full', () => {
    const cinema = createCinema();
    // book all disability seats first
    allocateDisability(cinema, 3);
    allocateDisability(cinema, 3);
    // now try to book another
    const result = allocateDisability(cinema, 1);
    expect(result).toBeNull();
  });
});

describe('allocateVIP', () => {
  test('books seats only in VIP rows (E to I)', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 2);
    expect(result).not.toBeNull();
    const vipRows = ['E', 'F', 'G', 'H', 'I'];
    result.forEach(seat => {
      expect(vipRows).toContain(seat.row);
    });
  });

  test('books only VIP type seats', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(seat => {
      expect(seat.type).toBe('VIP');
    });
  });

  test('VIP seats are in columns 12 to 15', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 1);
    expect(result).not.toBeNull();
    result.forEach(seat => {
      expect(seat.col).toBeGreaterThanOrEqual(12);
      expect(seat.col).toBeLessThanOrEqual(15);
    });
  });
});

describe('allocateGroup', () => {
  test('books the right number of seats', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 4);
    expect(result).not.toBeNull();
    expect(result.length).toBe(4);
  });

  test('all seats in the same row', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 3);
    expect(result).not.toBeNull();
    const rows = result.map(s => s.row);
    expect(new Set(rows).size).toBe(1);
  });

  test('seats are next to each other', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 3);
    expect(result).not.toBeNull();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].col - result[i - 1].col).toBe(1);
    }
  });

  test('does not book broken seats', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(seat => {
      expect(seat.type).not.toBe('BROKEN');
      expect(seat.status).not.toBe('BROKEN');
    });
  });

  test('does not book disability seats for normal group', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(seat => {
      expect(seat.type).not.toBe('DISABILITY');
    });
  });

  test('anti-scatter: picks block that creates fewest single gaps', () => {
    // build a specific cinema state manually
    const cinema = createCinema();
    // book seats 1 to 5 in row G (index 6), then book seat 7
    // col index 0 to 4 = cols 1 to 5 booked, col 6 = col 7 booked
    // leaves col 5 (col 6) as a single gap
    // now booking group of 2 should NOT land at cols 6-7 because that would make it worse
    for (let i = 0; i < 5; i++) {
      cinema[6][i].status = 'BOOKED';
    }
    cinema[6][6].status = 'BOOKED';
    // col 5 (index 5) is now a single gap in row G
    // a good algorithm should try to fill that gap or go to another row
    const result = allocateGroup(cinema, 2);
    expect(result).not.toBeNull();
    // result should not create extra gaps
    const rowAfter = cinema[result[0].row === 'A' ? 0 :
      result[0].row === 'B' ? 1 :
      result[0].row === 'C' ? 2 :
      result[0].row === 'D' ? 3 :
      result[0].row === 'E' ? 4 :
      result[0].row === 'F' ? 5 :
      result[0].row === 'G' ? 6 :
      result[0].row === 'H' ? 7 :
      result[0].row === 'I' ? 8 :
      result[0].row === 'J' ? 9 :
      result[0].row === 'K' ? 10 :
      result[0].row === 'L' ? 11 :
      result[0].row === 'M' ? 12 :
      result[0].row === 'N' ? 13 : 14
    ];
    const gaps = countSingleGaps(rowAfter);
    expect(gaps).toBeLessThanOrEqual(1);
  });
});

describe('allocateSolo', () => {
  test('books exactly 1 seat', () => {
    const cinema = createCinema();
    const result = allocateSolo(cinema);
    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
  });

  test('does not book a broken seat', () => {
    const cinema = createCinema();
    const result = allocateSolo(cinema);
    expect(result).not.toBeNull();
    expect(result[0].type).not.toBe('BROKEN');
  });
});

describe('allocateSeats (main entry)', () => {
  test('disability booking goes to row A or B', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 2, bookingType: 'DISABILITY', adminOverride: false });
    expect(result).not.toBeNull();
    expect(['A', 'B']).toContain(result[0].row);
  });

  test('VIP booking goes to VIP zone', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 2, bookingType: 'VIP', adminOverride: false });
    expect(result).not.toBeNull();
    const vipRows = ['E', 'F', 'G', 'H', 'I'];
    expect(vipRows).toContain(result[0].row);
  });

  test('admin override books anywhere ignoring rules', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 5, bookingType: 'NORMAL', adminOverride: true });
    expect(result).not.toBeNull();
    expect(result.length).toBe(5);
  });

  test('returns null when cinema is full', () => {
    const cinema = createCinema();
    // book everything
    for (const row of cinema) {
      for (const seat of row) {
        if (seat.status === 'FREE') seat.status = 'BOOKED';
      }
    }
    const result = allocateSeats(cinema, { groupSize: 2, bookingType: 'NORMAL', adminOverride: false });
    expect(result).toBeNull();
  });
});

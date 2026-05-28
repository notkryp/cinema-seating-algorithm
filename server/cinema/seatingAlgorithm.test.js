// seatingAlgorithm.test.js
// TDD-first tests — written to define expected behaviour before implementation.
// Covers gap detection, each booking type, the split fallback, and stress.

const { createCinema } = require('./cinemaSetup');
const {
  allocateSeats,
  countSingleGaps,
  allocateDisability,
  allocateVIP,
  allocateGroup,
  allocateGroupSplit,
  allocateSolo
} = require('./seatingAlgorithm');

// ─── helpers ──────────────────────────────────────────────────────────────────

// Build a minimal fake row from a pattern string.
// B = BOOKED  F = FREE  X = BROKEN
function makeRow(pattern) {
  return pattern.split('').map((ch, i) => ({
    row:    'A',
    col:    i + 1,
    type:   ch === 'X' ? 'BROKEN' : 'REGULAR',
    status: ch === 'B' ? 'BOOKED' : ch === 'X' ? 'BROKEN' : 'FREE'
  }));
}

// Map a row letter to its 0-based index
const ROW_IDX = { A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14 };

// ─── countSingleGaps ──────────────────────────────────────────────────────────

describe('countSingleGaps', () => {
  test('empty row has no gaps', () => {
    expect(countSingleGaps(makeRow('FFFFFFFF'))).toBe(0);
  });

  test('single free seat between two booked seats is a gap', () => {
    expect(countSingleGaps(makeRow('BFB'))).toBe(1);
  });

  test('two adjacent free seats are not a gap', () => {
    expect(countSingleGaps(makeRow('BFFB'))).toBe(0);
  });

  test('broken seats are not counted as gaps', () => {
    expect(countSingleGaps(makeRow('BXB'))).toBe(0);
  });

  test('counts multiple independent gaps', () => {
    // B F B F B => 2 gaps
    expect(countSingleGaps(makeRow('BFBFB'))).toBe(2);
  });
});

// ─── allocateDisability ───────────────────────────────────────────────────────

describe('allocateDisability', () => {
  test('books seats only in row A or B', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    expect(['A', 'B']).toContain(result[0].row);
  });

  test('all booked seats are type DISABILITY', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(s => expect(s.type).toBe('DISABILITY'));
  });

  test('seats are adjacent', () => {
    const cinema = createCinema();
    const result = allocateDisability(cinema, 2);
    expect(result).not.toBeNull();
    expect(result[1].col - result[0].col).toBe(1);
  });

  test('returns null when all disability seats are full', () => {
    const cinema = createCinema();
    allocateDisability(cinema, 3);
    allocateDisability(cinema, 3);
    expect(allocateDisability(cinema, 1)).toBeNull();
  });
});

// ─── allocateVIP ──────────────────────────────────────────────────────────────

describe('allocateVIP', () => {
  test('books seats only in VIP rows E-I', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(s => expect(['E','F','G','H','I']).toContain(s.row));
  });

  test('all booked seats are type VIP', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(s => expect(s.type).toBe('VIP'));
  });

  test('VIP seats land in columns 12-15', () => {
    const cinema = createCinema();
    const result = allocateVIP(cinema, 1);
    expect(result).not.toBeNull();
    result.forEach(s => {
      expect(s.col).toBeGreaterThanOrEqual(12);
      expect(s.col).toBeLessThanOrEqual(15);
    });
  });
});

// ─── allocateGroup ────────────────────────────────────────────────────────────

describe('allocateGroup', () => {
  test('books the right number of seats', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 4);
    expect(result).not.toBeNull();
    expect(result.length).toBe(4);
  });

  test('all seats are in the same row', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 3);
    expect(result).not.toBeNull();
    expect(new Set(result.map(s => s.row)).size).toBe(1);
  });

  test('seats are contiguous', () => {
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
    result.forEach(s => expect(s.status).not.toBe('BROKEN'));
  });

  test('does not book disability seats for a regular group', () => {
    const cinema = createCinema();
    const result = allocateGroup(cinema, 2);
    expect(result).not.toBeNull();
    result.forEach(s => expect(s.type).not.toBe('DISABILITY'));
  });

  test('anti-scatter: picks the block that creates fewest single gaps', () => {
    const cinema = createCinema();
    // Force a known gap in row G: cols 1-5 booked, col 7 booked → col 6 is trapped
    for (let i = 0; i < 5; i++) cinema[6][i].status = 'BOOKED';
    cinema[6][6].status = 'BOOKED';

    const result = allocateGroup(cinema, 2);
    expect(result).not.toBeNull();
    const rowAfter = cinema[ROW_IDX[result[0].row]];
    expect(countSingleGaps(rowAfter)).toBeLessThanOrEqual(1);
  });
});

// ─── allocateGroupSplit ───────────────────────────────────────────────────────

describe('allocateGroupSplit (row-split fallback)', () => {
  test('seats the full group even when no single row has space', () => {
    const cinema = createCinema();
    // Fill all REGULAR rows so each row only has a 3-seat gap max
    // by booking cols 1-25 in every regular row (leaves cols 26-28 free = 3 seats)
    for (let r = 2; r < 15; r++) { // rows C-O
      for (let c = 0; c < 25; c++) {
        if (cinema[r][c].type === 'REGULAR') cinema[r][c].status = 'BOOKED';
      }
    }
    // group of 7 can't fit in 3 seats — needs at least 3 rows
    const result = allocateGroupSplit(cinema, 7);
    expect(result).not.toBeNull();
    expect(result.length).toBe(7);
  });

  test('all split seats are REGULAR (not DISABILITY or VIP)', () => {
    const cinema = createCinema();
    for (let r = 2; r < 15; r++) {
      for (let c = 0; c < 25; c++) {
        if (cinema[r][c].type === 'REGULAR') cinema[r][c].status = 'BOOKED';
      }
    }
    const result = allocateGroupSplit(cinema, 5);
    expect(result).not.toBeNull();
    result.forEach(s => expect(s.type).toBe('REGULAR'));
  });

  test('returns null when cinema has no capacity left', () => {
    const cinema = createCinema();
    for (const row of cinema)
      for (const s of row)
        if (s.status === 'FREE') s.status = 'BOOKED';
    expect(allocateGroupSplit(cinema, 3)).toBeNull();
  });

  test('split seats are tagged with split:true', () => {
    const cinema = createCinema();
    for (let r = 2; r < 15; r++) {
      for (let c = 0; c < 25; c++) {
        if (cinema[r][c].type === 'REGULAR') cinema[r][c].status = 'BOOKED';
      }
    }
    const result = allocateGroupSplit(cinema, 4);
    expect(result).not.toBeNull();
    result.forEach(s => expect(s.split).toBe(true));
  });
});

// ─── allocateSolo ─────────────────────────────────────────────────────────────

describe('allocateSolo', () => {
  test('books exactly 1 seat', () => {
    const cinema = createCinema();
    expect(allocateSolo(cinema).length).toBe(1);
  });

  test('does not book a broken seat', () => {
    const cinema = createCinema();
    const result = allocateSolo(cinema);
    expect(result[0].type).not.toBe('BROKEN');
  });
});

// ─── allocateSeats (main entry) ────────────────────────────────────────────────

describe('allocateSeats — main entry', () => {
  test('disability booking lands in row A or B', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 2, bookingType: 'DISABILITY', adminOverride: false });
    expect(result).not.toBeNull();
    expect(['A', 'B']).toContain(result[0].row);
  });

  test('VIP booking lands in the VIP zone', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 2, bookingType: 'VIP', adminOverride: false });
    expect(result).not.toBeNull();
    expect(['E','F','G','H','I']).toContain(result[0].row);
  });

  test('admin override books regardless of type zones', () => {
    const cinema = createCinema();
    const result = allocateSeats(cinema, { groupSize: 5, bookingType: 'NORMAL', adminOverride: true });
    expect(result).not.toBeNull();
    expect(result.length).toBe(5);
  });

  test('falls back to split when no contiguous block is available', () => {
    const cinema = createCinema();
    // Leave only 2-seat gaps in regular rows
    for (let r = 2; r < 15; r++) {
      let booked = 0;
      for (let c = 0; c < cinema[r].length; c++) {
        if (cinema[r][c].type !== 'REGULAR') continue;
        // book in stretches of 26, leave 2 free
        if (booked < 26) { cinema[r][c].status = 'BOOKED'; booked++; }
      }
    }
    const result = allocateSeats(cinema, { groupSize: 5, bookingType: 'NORMAL', adminOverride: false });
    expect(result).not.toBeNull();
    expect(result.length).toBe(5);
  });

  test('returns null when cinema is completely full', () => {
    const cinema = createCinema();
    for (const row of cinema)
      for (const s of row)
        if (s.status === 'FREE') s.status = 'BOOKED';
    expect(allocateSeats(cinema, { groupSize: 2, bookingType: 'NORMAL', adminOverride: false })).toBeNull();
  });
});

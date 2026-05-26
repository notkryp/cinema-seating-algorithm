import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API = 'http://localhost:3001/api';
const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

// what colour each seat gets
function getSeatClass(seat, justBookedSet) {
  const id = `${seat.row}${seat.col}`;
  if (justBookedSet.has(id)) return 'seat just-booked';
  if (seat.type === 'BROKEN' || seat.status === 'BROKEN') return 'seat broken';
  if (seat.status === 'BOOKED') return 'seat booked';
  if (seat.type === 'VIP') return 'seat vip';
  if (seat.type === 'DISABILITY') return 'seat disability';
  return 'seat free';
}

export default function App() {
  const [cinema, setCinema]         = useState(null);
  const [groupSize, setGroupSize]   = useState(2);
  const [bookType, setBookType]     = useState('NORMAL');
  const [admin, setAdmin]           = useState(false);
  const [toast, setToast]           = useState(null);
  const [lastBooked, setLastBooked] = useState(new Set());
  const [stats, setStats]           = useState({ total: 0, booked: 0, broken: 0 });

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function calcStats(c) {
    let total = 0, booked = 0, broken = 0;
    for (const row of c) {
      for (const s of row) {
        if (s.type === 'BROKEN' || s.status === 'BROKEN') { broken++; continue; }
        total++;
        if (s.status === 'BOOKED') booked++;
      }
    }
    setStats({ total, booked, broken });
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cinema`);
      const d = await r.json();
      setCinema(d.cinema);
      calcStats(d.cinema);
    } catch {
      showToast('Cannot reach server. Start the backend on port 3001.', false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function book() {
    try {
      const r = await fetch(`${API}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize, bookingType: bookType, adminOverride: admin })
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error, false); return; }
      setCinema(d.cinema);
      calcStats(d.cinema);
      const ids = new Set(d.booked.map(s => `${s.row}${s.col}`));
      setLastBooked(ids);
      setTimeout(() => setLastBooked(new Set()), 2000);
      showToast(`Booked: ${[...ids].join(', ')}`);
    } catch {
      showToast('Booking failed', false);
    }
  }

  async function reset() {
    try {
      const r = await fetch(`${API}/cinema/reset`, { method: 'POST' });
      const d = await r.json();
      setCinema(d.cinema);
      calcStats(d.cinema);
      setLastBooked(new Set());
      showToast('New session started');
    } catch {
      showToast('Reset failed', false);
    }
  }

  async function stressTest() {
    showToast('Filling cinema...');
    const groups = [3,2,4,2,5,1,3,2,6,2,4,1,2,3,2,4,3,1,2,5];
    for (const size of groups) {
      const type = size > 3 ? 'VIP' : 'NORMAL';
      await fetch(`${API}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize: size, bookingType: type, adminOverride: false })
      }).catch(() => {});
    }
    await load();
    showToast('Cinema half-filled — ready for demo!');
  }

  if (!cinema) {
    return (
      <div className="center-screen">
        <div className="spinner"></div>
        <p>Loading cinema...</p>
      </div>
    );
  }

  const pct = Math.round((stats.booked / stats.total) * 100);

  return (
    <div className="page">

      {/* top bar */}
      <header>
        <div className="header-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M8 4v16M16 4v16"/>
          </svg>
          <span>Cinema Seating</span>
        </div>
        <div className="header-stats">
          <span>{stats.booked} / {stats.total} seats booked</span>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
          <span>{pct}%</span>
        </div>
      </header>

      {/* toast */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
          {toast.msg}
        </div>
      )}

      <div className="body">

        {/* left: controls */}
        <aside>
          <section className="card">
            <h2>Book seats</h2>

            {/* group size picker */}
            <label>How many people?</label>
            <div className="size-picker">
              {[1,2,3,4,5,6,7].map(n => (
                <button
                  key={n}
                  className={groupSize === n ? 'size-btn active' : 'size-btn'}
                  onClick={() => setGroupSize(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* seat type */}
            <label>Seat type</label>
            <div className="type-picker">
              {[['NORMAL','🪑 Normal'],['VIP','⭐ VIP'],['DISABILITY','♿ Disability']].map(([val, label]) => (
                <button
                  key={val}
                  className={bookType === val ? 'type-btn active' : 'type-btn'}
                  onClick={() => setBookType(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* admin toggle */}
            <label className="toggle-row" onClick={() => setAdmin(a => !a)}>
              <div className={`toggle ${admin ? 'on' : ''}`}>
                <div className="toggle-thumb"></div>
              </div>
              <span>Admin override</span>
            </label>
            {admin && <p className="admin-note">Rules are OFF — seats go anywhere</p>}

            <button className="btn-primary" onClick={book}>
              Book {groupSize} {groupSize === 1 ? 'seat' : 'seats'}
            </button>
          </section>

          <section className="card actions-card">
            <h2>Session</h2>
            <button className="btn-secondary" onClick={stressTest}>
              Half-fill cinema
            </button>
            <button className="btn-danger" onClick={reset}>
              Reset / New session
            </button>
          </section>

          {/* legend */}
          <section className="card legend-card">
            <h2>Legend</h2>
            <div className="legend">
              <div className="leg"><span className="dot free"></span>Free</div>
              <div className="leg"><span className="dot vip"></span>VIP</div>
              <div className="leg"><span className="dot disability"></span>Disability</div>
              <div className="leg"><span className="dot booked"></span>Booked</div>
              <div className="leg"><span className="dot broken"></span>Broken</div>
              <div className="leg"><span className="dot just-booked"></span>Just booked</div>
            </div>
          </section>
        </aside>

        {/* right: cinema grid */}
        <main>
          <div className="screen-bar">🎬 SCREEN</div>

          {/* col numbers */}
          <div className="col-numbers">
            <span className="row-tag"></span>
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} className="col-tag">{i + 1}</span>
            ))}
          </div>

          {cinema.map((row, ri) => (
            <div key={ri} className="cinema-row">
              <span className="row-tag">{ROWS[ri]}</span>
              {row.map((seat, ci) => (
                <div
                  key={ci}
                  className={getSeatClass(seat, lastBooked)}
                  title={`${seat.row}${seat.col} · ${seat.type} · ${seat.status}`}
                />
              ))}
              <span className="row-tag end">{ROWS[ri]}</span>
            </div>
          ))}

          <p className="vip-hint">VIP zone — rows E to I, columns 12 to 15</p>
        </main>
      </div>
    </div>
  );
}

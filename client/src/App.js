import React, { useState, useEffect, useCallback } from 'react';
import CinemaGrid from './components/CinemaGrid';
import BookingControls from './components/BookingControls';
import BookingLog from './components/BookingLog';
import './App.css';

const API = 'http://localhost:3001/api';

function App() {
  const [cinema, setCinema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [log, setLog] = useState([]);
  const [lastBooked, setLastBooked] = useState([]);

  const fetchCinema = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cinema`);
      const data = await res.json();
      setCinema(data.cinema);
    } catch (e) {
      setMessage('Could not connect to server. Make sure the backend is running on port 3001.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCinema();
  }, [fetchCinema]);

  async function handleBook(groupSize, bookingType, adminOverride) {
    setMessage('');
    try {
      const res = await fetch(`${API}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize, bookingType, adminOverride })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Booking failed');
        return;
      }
      setCinema(data.cinema);
      setLastBooked(data.booked.map(s => `${s.row}${s.col}`));
      const seatList = data.booked.map(s => `${s.row}${s.col}`).join(', ');
      const entry = `Booked ${groupSize}x ${bookingType}${adminOverride ? ' (admin)' : ''}: ${seatList}`;
      setLog(prev => [entry, ...prev].slice(0, 20));
      setMessage(`Seats booked: ${seatList}`);
    } catch (e) {
      setMessage('Server error. Is the backend running?');
    }
  }

  async function handleReset() {
    setMessage('');
    setLastBooked([]);
    setLog([]);
    try {
      const res = await fetch(`${API}/cinema/reset`, { method: 'POST' });
      const data = await res.json();
      setCinema(data.cinema);
      setMessage('Cinema reset - new session started');
    } catch (e) {
      setMessage('Reset failed');
    }
  }

  // stress test - book a bunch of random groups to half fill the cinema
  async function handleStressTest() {
    setMessage('Running stress test...');
    setLastBooked([]);
    const types = ['NORMAL', 'NORMAL', 'NORMAL', 'VIP'];
    const sizes = [2, 3, 4, 5, 2, 1, 3, 6, 2, 4, 1, 2, 3, 2, 4];
    for (const size of sizes) {
      const type = types[Math.floor(Math.random() * types.length)];
      try {
        await fetch(`${API}/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupSize: size, bookingType: type, adminOverride: false })
        });
      } catch (e) {
        // ignore individual failures during stress test
      }
    }
    fetchCinema();
    setMessage('Stress test done - cinema is now partially filled');
  }

  if (loading) return <div className="loading">Loading cinema...</div>;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cinema Seating Algorithm</h1>
        <p className="subtitle">ATSE Assessment 3 - Abhishek Pokharel</p>
      </header>

      <div className="legend">
        <span className="legend-item"><span className="dot regular"></span>Regular (Free)</span>
        <span className="legend-item"><span className="dot vip"></span>VIP (Free)</span>
        <span className="legend-item"><span className="dot disability"></span>Disability (Free)</span>
        <span className="legend-item"><span className="dot booked"></span>Booked</span>
        <span className="legend-item"><span className="dot broken"></span>Broken</span>
        <span className="legend-item"><span className="dot justbooked"></span>Just Booked</span>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="main-layout">
        <div className="left-panel">
          <BookingControls
            onBook={handleBook}
            onReset={handleReset}
            onStressTest={handleStressTest}
          />
          <BookingLog log={log} />
        </div>

        <div className="right-panel">
          {cinema && (
            <CinemaGrid cinema={cinema} lastBooked={lastBooked} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

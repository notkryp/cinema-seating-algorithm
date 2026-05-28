import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge }      from './components/ui/badge';
import { Button }     from './components/ui/button';
import { Film, RotateCcw, Zap, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import BookingWizard from './components/BookingWizard';
import SeatResults   from './components/SeatResults';

const API = 'http://localhost:3001/api';

export default function App() {
  const [cinema, setCinema]             = useState(null);
  const [admin, setAdmin]               = useState(false);
  const [adminPanel, setAdminPanel]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [screen, setScreen]             = useState('wizard');
  const [pendingSeats, setPendingSeats] = useState([]);
  const [lastParams, setLastParams]     = useState(null);
  const [lastMovie, setLastMovie]       = useState(null);
  const [confirming, setConfirming]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const toastTimer = useRef(null);

  function showToast(msg, ok = true) {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  function stats(c) {
    if (!c) return { total: 0, booked: 0, broken: 0, pct: 0 };
    let total = 0, booked = 0, broken = 0;
    for (const row of c)
      for (const s of row) {
        if (s.status === 'BROKEN') { broken++; continue; }
        total++;
        if (s.status === 'BOOKED') booked++;
      }
    return { total, booked, broken, pct: total ? Math.round(booked / total * 100) : 0 };
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cinema`);
      const d = await r.json();
      setCinema(d.cinema);
    } catch {
      showToast('Can\'t reach the server — make sure the backend is running on port 3001', false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Find seats (preview) ──────────────────────────────────────────────────
  async function handleFindSeats(params, movie) {
    setLoading(true);
    setLastParams(params);
    setLastMovie(movie);
    try {
      const r = await fetch(`${API}/book/preview`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...params, adminOverride: admin }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || 'No seats available right now', false);
        return;
      }
      setPendingSeats(d.seats);
      setCinema(d.cinema);
      setScreen('results');
    } catch {
      showToast('Search failed — check your connection', false);
    } finally {
      setLoading(false);
    }
  }

  // ── Confirm algorithm recommendation ─────────────────────────────────────
  async function handleConfirm() {
    if (!lastParams) return;
    setConfirming(true);
    try {
      const r = await fetch(`${API}/book`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...lastParams, adminOverride: admin }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Booking didn\'t go through', false); return; }
      setCinema(d.cinema);
      showToast(`Booked! ${d.booking.seats.join('  ')}`);
      setScreen('wizard');
      setPendingSeats([]);
    } catch {
      showToast('Something went wrong — try again', false);
    } finally {
      setConfirming(false);
    }
  }

  // ── Confirm manual seat picks ─────────────────────────────────────────────
  async function handleConfirmManual(manualSeats) {
    if (!lastParams) return;
    setConfirming(true);
    try {
      const seatIds = manualSeats.map(s => `${s.row}${s.col}`);
      const r = await fetch(`${API}/book/manual`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          seats:       seatIds,
          bookingType: lastParams.bookingType,
          movie:       lastMovie?.title,
        }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Booking didn\'t go through', false); return; }
      setCinema(d.cinema);
      showToast(`Booked! ${d.booking.seats.join('  ')}`);
      setScreen('wizard');
      setPendingSeats([]);
    } catch {
      showToast('Something went wrong — try again', false);
    } finally {
      setConfirming(false);
    }
  }

  async function reset() {
    try {
      const r = await fetch(`${API}/cinema/reset`, { method: 'POST' });
      const d = await r.json();
      setCinema(d.cinema);
      setPendingSeats([]);
      setScreen('wizard');
      showToast('Fresh session started');
    } catch { showToast('Reset failed — try again', false); }
  }

  async function stressTest() {
    showToast('Filling up the cinema…');
    const groups = [3,2,4,2,5,1,3,2,6,2,4,1,2,3,2,4,3,1,2,5,3,2,4,2,3,1,5,2,3,4];
    for (const size of groups) {
      await fetch(`${API}/book`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ groupSize: size, bookingType: size > 3 ? 'VIP' : 'NORMAL', adminOverride: false }),
      }).catch(() => {});
    }
    await load();
    showToast('Cinema is half full — ready to demo!');
  }

  const s = stats(cinema);

  if (!cinema) return (
    <div className="flex h-screen items-center justify-center flex-col gap-4">
      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm">Loading cinema…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <span className="font-semibold tracking-tight">Cinema Seating</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdminPanel(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              adminPanel
                ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400'
                : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Admin
            {adminPanel ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </button>
          <span className="text-muted-foreground text-xs">{s.booked}/{s.total}</span>
          <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${s.pct}%` }} />
          </div>
          <Badge variant="secondary">{s.pct}%</Badge>
          <Badge variant="destructive" className="text-xs">{s.broken} broken</Badge>
        </div>
      </header>

      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {adminPanel && (
        <div className="border-b border-yellow-500/20 bg-yellow-500/5 px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setAdmin(a => !a)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              admin
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Override {admin ? 'ON' : 'OFF'}
          </button>
          <Button variant="secondary" size="sm" onClick={stressTest}>
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Half-fill
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset session
          </Button>
        </div>
      )}

      <div className="p-6">
        {screen === 'wizard'
          ? <BookingWizard onFindSeats={handleFindSeats} loading={loading} />
          : <SeatResults
              cinema={cinema}
              bookedSeats={pendingSeats}
              movie={lastMovie}
              params={lastParams}
              onConfirm={handleConfirm}
              onConfirmManual={handleConfirmManual}
              onBack={() => { setScreen('wizard'); setPendingSeats([]); }}
              confirming={confirming}
            />
        }
      </div>
    </div>
  );
}

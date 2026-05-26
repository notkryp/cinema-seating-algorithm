import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Film, RotateCcw, Zap, Users, Star, Accessibility, ShieldAlert } from 'lucide-react';

const API = 'http://localhost:3001/api';
const ROW_LABELS = list => list;
const ROWS = 'ABCDEFGHIJKLMNO'.split('');

const SEAT_STYLES = {
  FREE:       'bg-blue-600/70 hover:bg-blue-500',
  VIP:        'bg-purple-600/80 hover:bg-purple-500',
  DISABILITY: 'bg-teal-500/80 hover:bg-teal-400',
  BOOKED:     'bg-zinc-700 cursor-default',
  BROKEN:     'bg-red-900/60 cursor-not-allowed opacity-50',
  FLASH:      'bg-yellow-400 seat-flash',
};

function getSeatStyle(seat, flashSet) {
  const id = `${seat.row}${seat.col}`;
  if (flashSet.has(id)) return SEAT_STYLES.FLASH;
  if (seat.status === 'BROKEN') return SEAT_STYLES.BROKEN;
  if (seat.status === 'BOOKED') return SEAT_STYLES.BOOKED;
  if (seat.type === 'VIP') return SEAT_STYLES.VIP;
  if (seat.type === 'DISABILITY') return SEAT_STYLES.DISABILITY;
  return SEAT_STYLES.FREE;
}

export default function App() {
  const [cinema, setCinema]       = useState(null);
  const [groupSize, setGroupSize] = useState(2);
  const [bookType, setBookType]   = useState('NORMAL');
  const [admin, setAdmin]         = useState(false);
  const [flash, setFlash]         = useState(new Set());
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const toastTimer = useRef(null);

  function showToast(msg, ok = true) {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
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
      showToast('Cannot reach server — start backend on port 3001', false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function book() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize, bookingType: bookType, adminOverride: admin }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Booking failed', false); return; }
      setCinema(d.cinema);
      const ids = new Set(d.booked.map(s => `${s.row}${s.col}`));
      setFlash(ids);
      setTimeout(() => setFlash(new Set()), 1800);
      showToast(`✓ Booked: ${[...ids].join('  ')}`);
    } catch {
      showToast('Booking failed', false);
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    try {
      const r = await fetch(`${API}/cinema/reset`, { method: 'POST' });
      const d = await r.json();
      setCinema(d.cinema);
      setFlash(new Set());
      showToast('New session started');
    } catch { showToast('Reset failed', false); }
  }

  async function stressTest() {
    showToast('Filling cinema…');
    const groups = [3,2,4,2,5,1,3,2,6,2,4,1,2,3,2,4,3,1,2,5,3,2,4,2,3,1,5,2,3,4];
    for (const size of groups) {
      await fetch(`${API}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize: size, bookingType: size > 3 ? 'VIP' : 'NORMAL', adminOverride: false }),
      }).catch(() => {});
    }
    await load();
    showToast('Cinema half-filled — stress test done!');
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

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <span className="font-semibold tracking-tight">Cinema Seating</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">{s.booked} / {s.total} booked</span>
          <div className="w-28 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${s.pct}%` }} />
          </div>
          <Badge variant="secondary">{s.pct}%</Badge>
          <Badge variant="destructive" className="text-xs">{s.broken} broken</Badge>
        </div>
      </header>

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex gap-5 p-5 items-start">

        {/* ── SIDEBAR ── */}
        <aside className="w-56 shrink-0 flex flex-col gap-4">

          {/* Book card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Book Seats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Group size */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Group size</p>
                <div className="grid grid-cols-7 gap-1">
                  {[1,2,3,4,5,6,7].map(n => (
                    <button
                      key={n}
                      onClick={() => setGroupSize(n)}
                      className={`rounded py-1.5 text-xs font-semibold transition-colors ${
                        groupSize === n
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Seat type */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Seat type</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { val: 'NORMAL',     label: 'Regular',     icon: <Users className="w-3 h-3" /> },
                    { val: 'VIP',        label: 'VIP',         icon: <Star className="w-3 h-3" /> },
                    { val: 'DISABILITY', label: 'Accessibility',icon: <Accessibility className="w-3 h-3" /> },
                  ].map(({ val, label, icon }) => (
                    <button
                      key={val}
                      onClick={() => setBookType(val)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        bookType === val
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Admin toggle */}
              <div>
                <button
                  onClick={() => setAdmin(a => !a)}
                  className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    admin ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  Admin override {admin ? 'ON' : 'OFF'}
                </button>
                {admin && <p className="text-[11px] text-yellow-500/80 mt-1.5 pl-1">All rules bypassed</p>}
              </div>

              <Button onClick={book} disabled={loading} className="w-full">
                {loading ? 'Booking…' : `Book ${groupSize} ${groupSize === 1 ? 'seat' : 'seats'}`}
              </Button>

            </CardContent>
          </Card>

          {/* Session card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="secondary" className="w-full text-xs" onClick={stressTest}>
                <Zap className="w-3 h-3 mr-1.5" /> Half-fill cinema
              </Button>
              <Button variant="outline" className="w-full text-xs" onClick={reset}>
                <RotateCcw className="w-3 h-3 mr-1.5" /> Reset session
              </Button>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {[
                  { color: 'bg-blue-600/70',    label: 'Free' },
                  { color: 'bg-purple-600/80',  label: 'VIP' },
                  { color: 'bg-teal-500/80',    label: 'Accessible' },
                  { color: 'bg-zinc-700',        label: 'Booked' },
                  { color: 'bg-red-900/60',      label: 'Broken' },
                  { color: 'bg-yellow-400',      label: 'Just booked' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* ── CINEMA GRID ── */}
        <main className="flex-1 overflow-x-auto">
          {/* Screen */}
          <div className="w-full text-center py-2 mb-5 rounded-lg text-[11px] font-bold tracking-[6px] text-blue-300 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 border border-blue-700/40">
            SCREEN
          </div>

          {/* Column numbers */}
          <div className="flex gap-[3px] mb-1 pl-[22px]">
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className="w-[18px] text-center text-[9px] text-muted-foreground/50">{i + 1}</div>
            ))}
          </div>

          {/* Rows */}
          {cinema.map((row, ri) => (
            <div key={ri} className="flex items-center gap-[3px] mb-[3px]">
              <span className="w-[18px] text-[11px] text-muted-foreground font-semibold text-center shrink-0">
                {ROWS[ri]}
              </span>
              {row.map((seat, ci) => (
                <div
                  key={ci}
                  title={`${seat.row}${seat.col} · ${seat.type} · ${seat.status}`}
                  className={`seat w-[18px] h-[15px] rounded-[2px] shrink-0 ${getSeatStyle(seat, flash)}`}
                />
              ))}
              <span className="w-[18px] text-[11px] text-muted-foreground/40 text-center shrink-0">
                {ROWS[ri]}
              </span>
            </div>
          ))}

          <p className="text-[11px] text-purple-400/70 text-center mt-3">
            ★ VIP zone — rows E–I, columns 12–15
          </p>
        </main>
      </div>
    </div>
  );
}

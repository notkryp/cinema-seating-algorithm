import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, X, MapPin, RotateCcw, Zap,
  ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronUp,
  Trash2, ArrowRightLeft, Check
} from 'lucide-react';

const API = 'http://localhost:3001/api';
const ROWS = 'ABCDEFGHIJKLMNO'.split('');

// ── Seat colour (admin view) ──────────────────────────────────────────────────
function getSeatBg(seat, selectedIds, hoveredId, moveTargets) {
  const id = `${seat.row}${seat.col}`;

  if (moveTargets.has(id))  return 'bg-green-400 ring-2 ring-green-300 scale-110 z-10 cursor-pointer';
  if (selectedIds.has(id))  return 'bg-yellow-400 ring-2 ring-yellow-300 scale-110 z-10 cursor-pointer';
  if (hoveredId === id)     return 'bg-zinc-400/60 ring-1 ring-zinc-300 scale-110 z-10 cursor-pointer';
  if (seat.status === 'BROKEN') return 'bg-red-900/50 opacity-40 cursor-not-allowed';
  if (seat.status === 'BOOKED') return 'bg-zinc-600 cursor-pointer';
  if (seat.type   === 'VIP')    return 'bg-purple-600/70 cursor-pointer';
  if (seat.type   === 'DISABILITY') return 'bg-teal-500/70 cursor-pointer';
  return 'bg-blue-600/50 cursor-pointer';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl ${
      toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.msg}
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, isActive, onSelect, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const cancelled = booking.status === 'CANCELLED';

  return (
    <div
      className={`rounded-xl border transition-all ${
        cancelled
          ? 'border-zinc-700/40 bg-zinc-900/40 opacity-50'
          : isActive
          ? 'border-yellow-500/60 bg-yellow-500/10'
          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
      }`}
    >
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => !cancelled && onSelect(booking)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-yellow-400 font-mono">{booking.ref}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              cancelled ? 'bg-zinc-700 text-zinc-400' :
              booking.bookingType === 'VIP' ? 'bg-purple-500/30 text-purple-300' :
              booking.bookingType === 'DISABILITY' ? 'bg-teal-500/30 text-teal-300' :
              'bg-blue-500/30 text-blue-300'
            }`}>{booking.bookingType}</span>
            {cancelled && <span className="text-[10px] text-zinc-500">CANCELLED</span>}
          </div>
          <p className="text-[11px] text-zinc-300 font-medium mt-0.5 truncate">
            {booking.customerName} · {booking.movie}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {booking.groupSize} seat{booking.groupSize > 1 ? 's' : ''} · {booking.method}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!cancelled && (
            <button
              onClick={e => { e.stopPropagation(); onCancel(booking.ref); }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Cancel booking"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-400 mb-1.5">Seats</p>
          <div className="flex flex-wrap gap-1">
            {booking.seats.map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">{s}</span>
            ))}
          </div>
          {booking.bookedAt && (
            <p className="text-[10px] text-zinc-600 mt-2">
              {new Date(booking.bookedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [cinema,        setCinema]        = useState(null);
  const [bookings,      setBookings]      = useState([]);
  const [toast,         setToast]         = useState(null);
  const [scale,         setScale]         = useState(1);
  const [hovered,       setHovered]       = useState(null);
  const [activeBooking, setActiveBooking] = useState(null); // booking being moved
  const [moveTargets,   setMoveTargets]   = useState(new Set()); // new seat IDs selected
  const [mode,          setMode]          = useState('view'); // 'view' | 'move'
  const [filter,        setFilter]        = useState('ALL'); // ALL | NORMAL | VIP | DISABILITY | CANCELLED
  const toastTimer = useRef(null);

  function showToast(msg, ok = true) {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const loadAll = useCallback(async () => {
    try {
      const [cr, br] = await Promise.all([
        fetch(`${API}/cinema`),
        fetch(`${API}/bookings`),
      ]);
      const [cd, bd] = await Promise.all([cr.json(), br.json()]);
      setCinema(cd.cinema);
      setBookings(bd.bookings);
    } catch {
      showToast('Cannot reach server — is the backend running?', false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Set of seat IDs that belong to the selected booking ──────────────────
  const activeSeatIds = new Set(
    activeBooking && activeBooking.status === 'CONFIRMED'
      ? activeBooking.seats
      : []
  );

  // ── Cancel a booking ──────────────────────────────────────────────────────
  async function cancelBooking(ref) {
    if (!window.confirm(`Cancel booking ${ref}?`)) return;
    try {
      const r = await fetch(`${API}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Cancel failed', false); return; }
      setCinema(d.cinema);
      setBookings(prev => prev.map(b => b.ref === ref ? { ...b, status: 'CANCELLED', cancelledAt: d.booking.cancelledAt } : b));
      if (activeBooking?.ref === ref) { setActiveBooking(null); setMode('view'); setMoveTargets(new Set()); }
      showToast(`${ref} cancelled`);
    } catch { showToast('Cancel failed', false); }
  }

  // ── Start move mode ───────────────────────────────────────────────────────
  function startMove(booking) {
    if (booking.status === 'CANCELLED') return;
    setActiveBooking(booking);
    setMoveTargets(new Set());
    setMode('move');
  }

  // ── Handle grid click in move mode ────────────────────────────────────────
  function handleSeatClick(seat) {
    const id = `${seat.row}${seat.col}`;

    if (mode === 'move' && activeBooking) {
      // Can't pick broken seats or already-booked seats that aren't part of this booking
      if (seat.status === 'BROKEN') return;
      if (seat.status === 'BOOKED' && !activeSeatIds.has(id)) return; // occupied by someone else

      setMoveTargets(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else {
          // Don't allow more than groupSize
          if (next.size >= activeBooking.groupSize) {
            showToast(`This booking has ${activeBooking.groupSize} seat${activeBooking.groupSize > 1 ? 's' : ''} — remove one first`, false);
            return prev;
          }
          next.add(id);
        }
        return next;
      });
      return;
    }

    // view mode: clicking a booked seat selects that booking
    if (mode === 'view' && seat.status === 'BOOKED') {
      const found = bookings.find(
        b => b.status === 'CONFIRMED' && b.seats.includes(id)
      );
      if (found) setActiveBooking(found);
    }
  }

  // ── Commit move ───────────────────────────────────────────────────────────
  async function commitMove() {
    if (!activeBooking || moveTargets.size !== activeBooking.groupSize) {
      showToast(`Select exactly ${activeBooking?.groupSize} seat${activeBooking?.groupSize > 1 ? 's' : ''} to move to`, false);
      return;
    }
    try {
      const r = await fetch(`${API}/admin/move`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ref:      activeBooking.ref,
          newSeats: [...moveTargets],
        }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Move failed', false); return; }
      setCinema(d.cinema);
      setBookings(prev => prev.map(b => b.ref === activeBooking.ref ? d.booking : b));
      setActiveBooking(d.booking);
      setMoveTargets(new Set());
      setMode('view');
      showToast(`${activeBooking.ref} moved to ${[...moveTargets].join(' ')}`);
    } catch { showToast('Move failed', false); }
  }

  function cancelMove() {
    setMode('view');
    setMoveTargets(new Set());
  }

  // ── Reset & stress ────────────────────────────────────────────────────────
  async function reset() {
    if (!window.confirm('Reset the whole session? All bookings will be lost.')) return;
    const r = await fetch(`${API}/cinema/reset`, { method: 'POST' });
    const d = await r.json();
    setCinema(d.cinema);
    setBookings(d.bookings);
    setActiveBooking(null);
    setMode('view');
    setMoveTargets(new Set());
    showToast('Session reset');
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
    await loadAll();
    showToast('Cinema half-filled!');
  }

  // ── Filtered bookings ─────────────────────────────────────────────────────
  const filtered = bookings.filter(b => {
    if (filter === 'ALL') return true;
    if (filter === 'CANCELLED') return b.status === 'CANCELLED';
    return b.bookingType === filter && b.status !== 'CANCELLED';
  });

  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length;

  if (!cinema) return (
    <div className="flex h-screen items-center justify-center flex-col gap-4 bg-zinc-950">
      <div className="h-10 w-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      <p className="text-zinc-400 text-sm">Loading admin panel…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Toast toast={toast} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-yellow-500/20 bg-zinc-950/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold tracking-tight text-yellow-400">Admin Panel</span>
          <span className="text-[10px] text-zinc-500 ml-1">— Cinema Seating</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{confirmedCount} active booking{confirmedCount !== 1 ? 's' : ''}</span>
          <button onClick={stressTest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors">
            <Zap className="w-3.5 h-3.5" /> Half-fill
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-400/40 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={() => window.close()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </header>

      {/* Move mode banner */}
      {mode === 'move' && activeBooking && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-300 font-medium">
              Moving <span className="font-bold font-mono">{activeBooking.ref}</span>
              &nbsp;— select {activeBooking.groupSize} new seat{activeBooking.groupSize > 1 ? 's' : ''}
              &nbsp;<span className="text-yellow-500">({moveTargets.size}/{activeBooking.groupSize} selected)</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={cancelMove} className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Cancel</button>
            <button
              onClick={commitMove}
              disabled={moveTargets.size !== activeBooking.groupSize}
              className="px-3 py-1.5 rounded-lg text-xs bg-yellow-500 text-black font-semibold hover:bg-yellow-400 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Confirm move
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT — bookings list */}
        <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
          {/* Filter tabs */}
          <div className="flex gap-1 p-3 border-b border-zinc-800">
            {['ALL','NORMAL','VIP','DISABILITY','CANCELLED'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                  filter === f
                    ? 'bg-yellow-500 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >{f}</button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-500 text-sm">No bookings</p>
                <p className="text-zinc-600 text-xs mt-1">Use half-fill to populate</p>
              </div>
            ) : (
              filtered.map(b => (
                <BookingCard
                  key={b.ref}
                  booking={b}
                  isActive={activeBooking?.ref === b.ref}
                  onSelect={startMove}
                  onCancel={cancelBooking}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT — cinema grid */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">

          {/* Active booking info strip */}
          {activeBooking && activeBooking.status === 'CONFIRMED' && mode === 'view' && (
            <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <MapPin className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold font-mono text-yellow-400">{activeBooking.ref}</span>
                <span className="text-xs text-zinc-400 ml-2">{activeBooking.customerName} · {activeBooking.groupSize} seat{activeBooking.groupSize > 1 ? 's' : ''}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeBooking.seats.map(s => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startMove(activeBooking)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/30 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Move seats
                </button>
                <button
                  onClick={() => cancelBooking(activeBooking.ref)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Cancel
                </button>
                <button onClick={() => setActiveBooking(null)} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center justify-end gap-1 mb-3">
            <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-zinc-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(1.8, +(s + 0.1).toFixed(2)))} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setScale(1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"><Maximize2 className="w-4 h-4" /></button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto">
            <div className="w-full text-center py-1.5 mb-4 rounded text-[10px] font-bold tracking-[6px] text-blue-300 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 border border-blue-700/40">
              SCREEN
            </div>

            <div className="flex justify-center">
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top', display: 'inline-block' }}>
                <div className="flex gap-[2px] mb-1 pl-[20px]">
                  {Array.from({ length: 28 }, (_, i) => (
                    <div key={i} style={{ width: 16 }} className="text-center text-[8px] text-zinc-600">{i + 1}</div>
                  ))}
                </div>

                {cinema.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-[2px] mb-[2px]">
                    <span style={{ width: 16 }} className="text-[10px] text-zinc-500 font-semibold text-center shrink-0">{ROWS[ri]}</span>
                    {row.map(seat => {
                      const id = `${seat.row}${seat.col}`;
                      const isClickable = seat.status !== 'BROKEN' &&
                        (mode === 'move'
                          ? seat.status === 'FREE' || activeSeatIds.has(id) // in move mode: free or current booking seats
                          : seat.status === 'BOOKED' // view mode: click booked to select
                        );
                      return (
                        <div
                          key={id}
                          title={`${id} — ${seat.type} — ${seat.status}`}
                          style={{ width: 16, height: 13 }}
                          className={`relative rounded-[2px] shrink-0 transition-all duration-100 ${
                            getSeatBg(seat, activeSeatIds, hovered, moveTargets)
                          } ${!isClickable && mode !== 'move' ? '' : 'cursor-pointer'}`}
                          onMouseEnter={() => isClickable && setHovered(id)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => handleSeatClick(seat)}
                        />
                      );
                    })}
                    <span style={{ width: 16 }} className="text-[10px] text-zinc-700 text-center shrink-0">{ROWS[ri]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { color: 'bg-yellow-400',     label: 'Selected booking' },
                { color: 'bg-green-400',      label: 'Move target' },
                { color: 'bg-blue-600/50',    label: 'Free' },
                { color: 'bg-purple-600/70',  label: 'VIP' },
                { color: 'bg-teal-500/70',    label: 'Accessible' },
                { color: 'bg-zinc-600',       label: 'Booked' },
                { color: 'bg-red-900/50',     label: 'Broken' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                  <span className="text-[11px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

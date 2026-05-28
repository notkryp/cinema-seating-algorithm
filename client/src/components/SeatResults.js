import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, MapPin, ZoomIn, ZoomOut, Maximize2, Sparkles, MousePointerClick, X } from 'lucide-react';
import { validateManualSelection, checkSeatTypeConflict, isVIPSeat } from '../lib/validateManualSelection';

const ROWS = 'ABCDEFGHIJKLMNO'.split('');

// ── Seat colours ─────────────────────────────────────────────────────────────
function getSeatBg(seat, bookedSet, manualSet, hoveredId, bookingType) {
  const id = `${seat.row}${seat.col}`;

  if (bookedSet.has(id))  return 'bg-yellow-400 cursor-default';
  if (manualSet.has(id))  return 'bg-orange-400 ring-2 ring-orange-300 scale-110 z-10 cursor-pointer';
  if (hoveredId === id)   return 'bg-yellow-200/70 ring-1 ring-yellow-300 scale-110 z-10 cursor-pointer';

  if (seat.status === 'BROKEN') return 'bg-red-900/50 opacity-40 cursor-not-allowed';
  if (seat.status === 'BOOKED') return 'bg-zinc-700 cursor-not-allowed';
  if (seat.type   === 'VIP')    return 'bg-purple-600/80 cursor-pointer';
  if (seat.type   === 'DISABILITY') return 'bg-teal-500/80 cursor-not-allowed';
  return 'bg-blue-600/70 cursor-pointer';
}

function isSeatClickable(seat, bookingType) {
  if (seat.status === 'BROKEN' || seat.status === 'BOOKED') return false;
  if (seat.type === 'DISABILITY') return bookingType === 'DISABILITY';
  return true;
}

// ── Alert modal ───────────────────────────────────────────────────────────────
function AlertModal({ alert, onConfirm, onCancel }) {
  if (!alert) return null;
  const isWarn  = alert.type === 'TWO_GAP' || alert.type === 'OVERCOUNT';
  const isError = alert.type === 'ONE_GAP' || alert.type === 'ZONE' || alert.type === 'LIMIT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${
          isError ? 'text-red-400' : 'text-amber-400'
        }`}>
          {isError ? 'Cannot select this seat' : 'Heads up'}
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed mb-5">{alert.message}</p>
        <div className="flex gap-2 justify-end">
          {isWarn && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >Pick different seats</button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
              >Yes, book these</button>
            </>
          )}
          {isError && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >Got it</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SeatResults({
  cinema, bookedSeats, movie, params,
  onConfirm, onConfirmManual,
  onBack, confirming
}) {
  const [hovered,     setHovered]     = useState(null);
  const [scale,       setScale]       = useState(1);
  const [manualSeats, setManualSeats] = useState([]);
  const [alert,       setAlert]       = useState(null);
  const [useManual,   setUseManual]   = useState(false);

  const bookedSet = useMemo(() =>
    new Set(bookedSeats.map(s => `${s.row}${s.col}`)),
    [bookedSeats]
  );
  const manualSet = useMemo(() =>
    new Set(manualSeats.map(s => `${s.row}${s.col}`)),
    [manualSeats]
  );

  const groupSize = parseInt(params?.groupSize) || 1;

  // ── Handle seat click ───────────────────────────────────────────────────────
  const handleSeatClick = useCallback((seat) => {
    if (!isSeatClickable(seat, params?.bookingType)) return;
    const id = `${seat.row}${seat.col}`;

    // Deselect if already picked
    if (manualSet.has(id)) {
      setManualSeats(prev => prev.filter(s => `${s.row}${s.col}` !== id));
      return;
    }

    // Zone conflict
    const zoneErr = checkSeatTypeConflict(seat, params?.bookingType);
    if (zoneErr) {
      setAlert({ type: 'ZONE', message: zoneErr });
      return;
    }

    // Hard cap — can't pick more seats than requested
    if (manualSeats.length >= groupSize) {
      setAlert({
        type: 'LIMIT',
        message: `You only requested ${groupSize} seat${groupSize > 1 ? 's' : ''}. Remove one of your current picks before adding another.`
      });
      return;
    }

    const newSelection = [...manualSeats, seat];
    const newIds       = newSelection.map(s => `${s.row}${s.col}`);

    // Gap validation
    const validation = validateManualSelection(cinema, newIds);
    if (!validation.ok) {
      if (validation.type === 'ONE_GAP') {
        setAlert({ type: 'ONE_GAP', message: validation.message });
        return;
      }
      if (validation.type === 'TWO_GAP') {
        setAlert({
          type: 'TWO_GAP',
          message: validation.message,
          pendingSeat: seat,
          pendingList: newSelection
        });
        return;
      }
    }

    setManualSeats(newSelection);
    setUseManual(true);
  }, [manualSeats, manualSet, cinema, params, groupSize]);

  function onAlertConfirm() {
    if (alert?.pendingList) {
      setManualSeats(alert.pendingList);
      setUseManual(true);
    }
    setAlert(null);
  }
  function onAlertCancel() {
    setAlert(null);
  }

  function handleConfirm() {
    if (useManual && manualSeats.length > 0) {
      onConfirmManual(manualSeats);
    } else {
      onConfirm();
    }
  }

  const activeSeats  = useManual && manualSeats.length > 0 ? manualSeats : bookedSeats;
  const confirmCount = activeSeats.length;

  return (
    <div className="flex flex-col h-full">
      <AlertModal alert={alert} onConfirm={onAlertConfirm} onCancel={onAlertCancel} />

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Change requirements
      </button>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Seat selection</p>
        <h2 className="text-lg font-semibold">{movie?.title}</h2>
        <p className="text-xs text-muted-foreground">
          {params?.bookingType} · {params?.groupSize} seat{params?.groupSize > 1 ? 's' : ''} requested
        </p>
      </div>

      <div className="flex items-center justify-end gap-1 mb-3">
        <button onClick={() => setScale(s => Math.max(0.6, +(s - 0.1).toFixed(2)))} className="p-1 rounded bg-secondary hover:bg-secondary/80"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(1.6, +(s + 0.1).toFixed(2)))} className="p-1 rounded bg-secondary hover:bg-secondary/80"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => setScale(1)} className="p-1 rounded bg-secondary hover:bg-secondary/80"><Maximize2 className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">

        {/* LEFT panel */}
        <div className="w-52 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <p className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">Recommended</p>
            </div>
            {bookedSeats.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No recommendation available.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {bookedSeats.map(seat => {
                  const id = `${seat.row}${seat.col}`;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30"
                    >
                      <MapPin className="w-3 h-3 text-yellow-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Row {seat.row}, Seat {seat.col}</p>
                        <p className="text-[10px] text-muted-foreground">{seat.type}</p>
                      </div>
                    </div>
                  );
                })}
                {!useManual && (
                  <button
                    onClick={() => { setUseManual(false); handleConfirm(); }}
                    className="mt-1 w-full py-1.5 rounded-lg text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-300 transition-colors"
                  >
                    Use these seats
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MousePointerClick className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Your picks</p>
            </div>
            {manualSeats.length === 0 ? (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Click any free seat on the grid to pick your own.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {manualSeats.map(seat => {
                  const id = `${seat.row}${seat.col}`;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-400/10 border border-orange-400/30"
                    >
                      <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Row {seat.row}, Seat {seat.col}</p>
                        <p className="text-[10px] text-muted-foreground">{seat.type}</p>
                      </div>
                      <button
                        onClick={() => setManualSeats(prev => prev.filter(s => `${s.row}${s.col}` !== id))}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => { setManualSeats([]); setUseManual(false); }}
                  className="mt-1 w-full py-1 rounded-lg text-[11px] text-muted-foreground hover:text-red-400 border border-border hover:border-red-400/40 transition-colors"
                >
                  Clear all picks
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — cinema grid */}
        <div className="flex-1 overflow-auto">
          <div className="w-full text-center py-1.5 mb-4 rounded text-[10px] font-bold tracking-[6px] text-blue-300 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 border border-blue-700/40">
            SCREEN
          </div>

          <div className="flex justify-center">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top', display: 'inline-block' }}>
              <div className="flex gap-[2px] mb-1 pl-[20px]">
                {Array.from({ length: 28 }, (_, i) => (
                  <div key={i} style={{ width: 16 }} className="text-center text-[8px] text-muted-foreground/40">{i + 1}</div>
                ))}
              </div>

              {cinema.map((row, ri) => (
                <div key={ri} className="flex items-center gap-[2px] mb-[2px]">
                  <span style={{ width: 16 }} className="text-[10px] text-muted-foreground font-semibold text-center shrink-0">{ROWS[ri]}</span>
                  {row.map(seat => {
                    const id = `${seat.row}${seat.col}`;
                    const clickable = isSeatClickable(seat, params?.bookingType) && !bookedSet.has(id);
                    return (
                      <div
                        key={id}
                        title={`${id} — ${seat.type} — ${seat.status}`}
                        style={{ width: 16, height: 13 }}
                        className={`relative rounded-[2px] shrink-0 transition-all duration-100 ${
                          getSeatBg(seat, bookedSet, manualSet, hovered, params?.bookingType)
                        }`}
                        onMouseEnter={() => clickable && setHovered(id)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => handleSeatClick(seat)}
                      />
                    );
                  })}
                  <span style={{ width: 16 }} className="text-[10px] text-muted-foreground/30 text-center shrink-0">{ROWS[ri]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { color: 'bg-yellow-400',  label: 'Recommended' },
              { color: 'bg-orange-400',  label: 'Your picks' },
              { color: 'bg-yellow-200/70 ring-1 ring-yellow-300', label: 'Hovered' },
              { color: 'bg-blue-600/70', label: 'Free' },
              { color: 'bg-purple-600/80', label: 'VIP' },
              { color: 'bg-teal-500/80', label: 'Accessible' },
              { color: 'bg-zinc-700',    label: 'Booked' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-border">
        {useManual && manualSeats.length > 0 ? (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-3 bg-orange-500 text-white font-semibold text-sm disabled:opacity-60 hover:bg-orange-400 transition-colors"
          >
            {confirming ? 'Confirming…' : `Confirm your picks — ${manualSeats.length} seat${manualSeats.length > 1 ? 's' : ''} →`}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={confirming || bookedSeats.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-3 bg-green-600 text-white font-semibold text-sm disabled:opacity-60 hover:bg-green-500 transition-colors"
          >
            {confirming ? 'Confirming…' : `Confirm booking — ${confirmCount} seat${confirmCount > 1 ? 's' : ''} →`}
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { ChevronLeft, MapPin, ZoomIn, ZoomOut, Maximize2, List } from 'lucide-react';

const ROWS = 'ABCDEFGHIJKLMNO'.split('');

const SEAT_COLOR = {
  FREE:       'bg-blue-600/70',
  VIP:        'bg-purple-600/80',
  DISABILITY: 'bg-teal-500/80',
  BOOKED:     'bg-zinc-700',
  BROKEN:     'bg-red-900/50 opacity-40',
};

function getSeatBg(seat, highlightSet, bookedSet) {
  const id = `${seat.row}${seat.col}`;
  if (bookedSet.has(id)) return 'bg-yellow-400';
  if (highlightSet.has(id)) return 'bg-yellow-300 ring-2 ring-yellow-400 scale-125 z-10';
  if (seat.status === 'BROKEN') return SEAT_COLOR.BROKEN;
  if (seat.status === 'BOOKED') return SEAT_COLOR.BOOKED;
  if (seat.type === 'VIP') return SEAT_COLOR.VIP;
  if (seat.type === 'DISABILITY') return SEAT_COLOR.DISABILITY;
  return SEAT_COLOR.FREE;
}

export default function SeatResults({ cinema, bookedSeats, movie, params, onConfirm, onBack, confirming }) {
  const [hovered, setHovered] = useState(null); // seat id like 'A3'
  const [scale, setScale] = useState(1);
  const [showList, setShowList] = useState(true);

  const seatSize = useMemo(() => ({ w: 16, h: 13 }), []);

  const bookedSet    = new Set(bookedSeats.map(s => `${s.row}${s.col}`));
  // When hovering a list item, highlight that group's seat — find which group it belongs to
  // bookedSeats is a flat array; each item has row, col
  const highlightSet = hovered ? new Set([hovered]) : new Set();

  return (
    <div className="flex flex-col h-full">
      {/* Controls: zoom + list toggle */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          title="Toggle seat list"
          onClick={() => setShowList(s => !s)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-secondary border-border hover:bg-secondary/80"
        >
          <List className="w-4 h-4" />
          {showList ? 'Hide list' : 'Show list'}
        </button>
        <div className="flex items-center gap-1">
          <button
            title="Zoom out"
            onClick={() => setScale(s => Math.max(0.6, +(s - 0.1).toFixed(2)))}
            className="p-1 rounded bg-secondary border-border hover:bg-secondary/80"
          ><ZoomOut className="w-4 h-4" /></button>
          <div className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</div>
          <button
            title="Zoom in"
            onClick={() => setScale(s => Math.min(1.6, +(s + 0.1).toFixed(2)))}
            className="p-1 rounded bg-secondary border-border hover:bg-secondary/80"
          ><ZoomIn className="w-4 h-4" /></button>
          <button
            title="Fit to screen"
            onClick={() => setScale(1)}
            className="p-1 rounded bg-secondary border-border hover:bg-secondary/80"
          ><Maximize2 className="w-4 h-4" /></button>
        </div>
      </div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Change requirements
      </button>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Best seats found</p>
        <h2 className="text-lg font-semibold">{movie?.title}</h2>
        <p className="text-xs text-muted-foreground">
          {params.bookingType} · {bookedSeats.length} seat{bookedSeats.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Split screen */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* LEFT — seat list */}
        {showList && (
          <div className="w-48 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Seat list</p>
          {bookedSeats.map(seat => {
            const id = `${seat.row}${seat.col}`;
            const isHovered = hovered === id;
            return (
              <div
                key={id}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-default transition-all ${
                  isHovered
                    ? 'bg-yellow-400/20 border-yellow-400/60 text-foreground'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${ isHovered ? 'text-yellow-400' : 'text-primary/60'}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Row {seat.row}, Seat {seat.col}</p>
                  <p className="text-[11px]">{seat.type}</p>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* RIGHT — cinema grid */}
        <div className="flex-1 overflow-auto">
          {/* Screen */}
          <div className="w-full text-center py-1.5 mb-4 rounded text-[10px] font-bold tracking-[6px] text-blue-300 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 border border-blue-700/40">
            SCREEN
          </div>

          <div className="flex justify-center">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top', display: 'inline-block' }}>
            {/* Column numbers */}
            <div className="flex gap-[2px] mb-1 pl-[20px]">
              {Array.from({ length: 28 }, (_, i) => (
                <div key={i} style={{ width: seatSize.w }} className="text-center text-[8px] text-muted-foreground/40">{i + 1}</div>
              ))}
            </div>

            {cinema.map((row, ri) => (
              <div key={ri} className="flex items-center gap-[2px] mb-[2px]">
                <span style={{ width: seatSize.w }} className="text-[10px] text-muted-foreground font-semibold text-center shrink-0">
                  {ROWS[ri]}
                </span>
                {row.map((seat) => {
                  const id = `${seat.row}${seat.col}`;
                  const isHighlighted = highlightSet.has(id);
                  const isBooked      = bookedSet.has(id);
                  return (
                    <div
                      key={id}
                      title={id}
                      style={{ width: seatSize.w, height: seatSize.h }}
                      className={`relative rounded-[2px] shrink-0 transition-all duration-150 ${
                        getSeatBg(seat, highlightSet, bookedSet)
                      }`}
                    />
                  );
                })}
                <span style={{ width: seatSize.w }} className="text-[10px] text-muted-foreground/30 text-center shrink-0">
                  {ROWS[ri]}
                </span>
              </div>
            ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { color: 'bg-yellow-400', label: 'Your seats' },
              { color: 'bg-yellow-300 ring-1 ring-yellow-400', label: 'Hovered' },
              { color: 'bg-blue-600/70', label: 'Free' },
              { color: 'bg-purple-600/80', label: 'VIP' },
              { color: 'bg-teal-500/80', label: 'Accessible' },
              { color: 'bg-zinc-700', label: 'Booked' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <div className="pt-4 mt-4 border-t border-border">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-3 bg-green-600 text-white font-semibold text-sm disabled:opacity-60 hover:bg-green-500 transition-colors"
        >
          {confirming ? 'Confirming…' : `Confirm booking — ${bookedSeats.length} seat${bookedSeats.length > 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  );
}

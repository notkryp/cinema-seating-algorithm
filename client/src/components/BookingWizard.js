import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  Film, Star, Users, Accessibility, ChevronRight, ChevronLeft,
  Ticket, MapPin, Clock
} from 'lucide-react';

const MOVIES = [
  { id: 1, title: 'Inception',       genre: 'Sci-Fi',   rating: '8.8', duration: '148 min' },
  { id: 2, title: 'The Dark Knight', genre: 'Action',   rating: '9.0', duration: '152 min' },
  { id: 3, title: 'Interstellar',    genre: 'Sci-Fi',   rating: '8.6', duration: '169 min' },
  { id: 4, title: 'Parasite',        genre: 'Thriller', rating: '8.5', duration: '132 min' },
  { id: 5, title: 'Dune: Part Two',  genre: 'Sci-Fi',   rating: '8.7', duration: '166 min' },
  { id: 6, title: 'Oppenheimer',     genre: 'Drama',    rating: '8.9', duration: '180 min' },
];

export default function BookingWizard({ onFindSeats, loading }) {
  const [step, setStep]         = useState(1);
  const [movie, setMovie]       = useState(null);
  const [category, setCategory] = useState('REGULAR');
  const [seatType, setSeatType] = useState('SINGLE');
  const [disabled, setDisabled] = useState(false);
  const [pax, setPax]           = useState(2);

  const vipSelected    = category === 'VIP';
  const groupSelected  = seatType  === 'GROUP';
  const disabledLocked = vipSelected;
  const categoryLocked = disabled;
  // disabled + group: max 2 (adjacent disabled pairs only)
  const maxPax = disabled ? 2 : 7;
  const minPax = 2;

  function bookingParams() {
    const bookingType = disabled ? 'DISABILITY' : vipSelected ? 'VIP' : 'NORMAL';
    const groupSize   = groupSelected ? pax : 1;
    return { groupSize, bookingType };
  }

  function handleCategoryChange(val) {
    if (categoryLocked) return;
    setCategory(val);
    if (val === 'VIP') setDisabled(false);
  }

  function handleDisabledChange(val) {
    if (disabledLocked) return;
    setDisabled(val);
    if (val) {
      setCategory('REGULAR');
      if (pax > 2) setPax(2);
    }
  }

  function handleSeatTypeChange(val) {
    setSeatType(val);
    if (val === 'SINGLE') setPax(2);
  }

  function handlePaxChange(val) {
    const n = Number(val);
    if (n >= minPax && n <= maxPax) setPax(n);
  }

  // ─── SCREEN 1: Movie selection ───────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Step 1 of 2</p>
          <h2 className="text-lg font-semibold">Select a movie</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {MOVIES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMovie(m); setStep(2); }}
              className="group text-left rounded-xl border border-border bg-secondary/40 hover:border-primary/60 hover:bg-secondary transition-all p-4"
            >
              {/* Poster placeholder */}
              <div className="w-full aspect-[2/3] rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-border mb-3 flex items-center justify-center">
                <Film className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-tight mb-0.5">{m.title}</p>
              <p className="text-[11px] text-muted-foreground mb-2">{m.genre}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-[11px] text-muted-foreground">{m.rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground">{m.duration}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── SCREEN 2: Requirements ───────────────────────────────────────────────
  const params   = bookingParams();
  const canFind  = groupSelected ? pax >= 2 : true;

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Back + breadcrumb */}
      <button
        onClick={() => setStep(1)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to movies
      </button>

      <div className="mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Step 2 of 2</p>
        <h2 className="text-lg font-semibold">{movie?.title}</h2>
        <p className="text-xs text-muted-foreground">Choose your seating requirements</p>
      </div>

      <div className="space-y-5">

        {/* Seat category */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Seat category</p>
          <div className="flex gap-2">
            {['REGULAR', 'VIP'].map(val => {
              const locked = categoryLocked;
              const active = category === val;
              return (
                <button
                  key={val}
                  disabled={locked}
                  onClick={() => handleCategoryChange(val)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-all ${
                    locked
                      ? 'opacity-40 cursor-not-allowed bg-secondary/30 border-border text-muted-foreground'
                      : active
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {val === 'VIP' && <Star className="w-3.5 h-3.5 inline mr-1.5" />}
                  {val === 'REGULAR' ? 'Regular' : 'VIP'}
                </button>
              );
            })}
          </div>
          {categoryLocked && (
            <p className="text-[11px] text-amber-500/80 mt-1.5">♿ Accessibility seats are always Regular</p>
          )}
        </div>

        {/* Seat type */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Seat type</p>
          <div className="flex gap-2">
            {['SINGLE', 'GROUP'].map(val => (
              <button
                key={val}
                onClick={() => handleSeatTypeChange(val)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-all ${
                  seatType === val
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                {val === 'GROUP' && <Users className="w-3.5 h-3.5 inline mr-1.5" />}
                {val === 'SINGLE' ? 'Single' : 'Group'}
              </button>
            ))}
          </div>
        </div>

        {/* Pax picker — group only */}
        {groupSelected && (
          <div>
            <p className="text-xs font-medium text-foreground mb-2">
              No. of people
              {disabled && <span className="ml-2 text-[11px] text-amber-500/80">(max 2 for accessibility)</span>}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handlePaxChange(pax - 1)}
                disabled={pax <= minPax}
                className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center font-semibold disabled:opacity-40 hover:bg-secondary/70 transition-colors"
              >−</button>
              <select
                value={pax}
                onChange={e => handlePaxChange(e.target.value)}
                className="flex-1 rounded-lg bg-secondary border border-border text-sm text-foreground px-3 py-2"
              >
                {Array.from({ length: maxPax - minPax + 1 }, (_, i) => i + minPax).map(n => (
                  <option key={n} value={n}>{n} people</option>
                ))}
              </select>
              <button
                onClick={() => handlePaxChange(pax + 1)}
                disabled={pax >= maxPax}
                className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center font-semibold disabled:opacity-40 hover:bg-secondary/70 transition-colors"
              >+</button>
            </div>
          </div>
        )}

        {/* Accessibility */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Accessibility</p>
          <div className="flex gap-2">
            {[{ val: false, label: 'No' }, { val: true, label: 'Disabled' }].map(({ val, label }) => {
              const locked = disabledLocked;
              const active = disabled === val;
              return (
                <button
                  key={String(val)}
                  disabled={locked}
                  onClick={() => handleDisabledChange(val)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-all ${
                    locked
                      ? 'opacity-40 cursor-not-allowed bg-secondary/30 border-border text-muted-foreground'
                      : active
                        ? val
                          ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                          : 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {val && <Accessibility className="w-3.5 h-3.5 inline mr-1.5" />}
                  {label}
                </button>
              );
            })}
          </div>
          {disabledLocked && (
            <p className="text-[11px] text-amber-500/80 mt-1.5">VIP seats are not accessibility seats</p>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-secondary/60 border border-border px-4 py-3 text-[12px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm mb-1">Your request</p>
          <p><span className="text-foreground">{movie?.title}</span> · {params.bookingType}</p>
          <p>{groupSelected ? `${params.groupSize} seats together` : 'Single seat'}</p>
        </div>

        <button
          disabled={loading || !canFind}
          onClick={() => onFindSeats(params)}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-3 bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60 hover:bg-primary/90 transition-colors"
        >
          {loading ? 'Searching…' : 'Find seats →'}
        </button>

      </div>
    </div>
  );
}

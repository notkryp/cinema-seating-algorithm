import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Film, Star, Users, Accessibility, ChevronRight, ChevronLeft, Ticket } from 'lucide-react';

const MOVIES = [
  { id: 1, title: 'Inception',          genre: 'Sci-Fi',   rating: '8.8' },
  { id: 2, title: 'The Dark Knight',    genre: 'Action',   rating: '9.0' },
  { id: 3, title: 'Interstellar',       genre: 'Sci-Fi',   rating: '8.6' },
  { id: 4, title: 'Parasite',           genre: 'Thriller', rating: '8.5' },
  { id: 5, title: 'Dune: Part Two',     genre: 'Sci-Fi',   rating: '8.7' },
  { id: 6, title: 'Oppenheimer',        genre: 'Drama',    rating: '8.9' },
];

export default function BookingWizard({ onBook, loading }) {
  const [step, setStep]             = useState(1);
  const [movie, setMovie]           = useState(null);
  const [category, setCategory]     = useState('REGULAR');  // REGULAR | VIP
  const [seatType, setSeatType]     = useState('SINGLE');   // SINGLE  | GROUP
  const [disabled, setDisabled]     = useState(false);
  const [pax, setPax]               = useState(2);

  // ── derived constraint flags ──────────────────────────────────────────────
  const vipSelected      = category === 'VIP';
  const groupSelected    = seatType  === 'GROUP';
  const disabledLocked   = vipSelected;          // VIP → disabled greyed
  const categoryLocked   = disabled;             // disabled → category greyed
  const maxPax           = disabled ? 6 : 7;
  const minPax           = 2;

  // derived booking params for the algorithm
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
      // clamp pax to 6 if group
      if (pax > 6) setPax(6);
    }
  }

  function handleSeatTypeChange(val) {
    setSeatType(val);
    if (val === 'SINGLE') setPax(2); // reset
  }

  function handlePaxChange(val) {
    const n = Number(val);
    if (n >= minPax && n <= maxPax) setPax(n);
  }

  // ── STEP 1 ───────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span>Step 1</span>
            <Badge variant="outline" className="text-[10px] px-1.5">Select movie</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MOVIES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMovie(m); setStep(2); }}
              className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all group ${
                movie?.id === m.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground">{m.genre}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-[11px] text-muted-foreground">{m.rating}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── STEP 2 ───────────────────────────────────────────────────────────────
  const params = bookingParams();
  const canBook = groupSelected ? pax >= 2 : true;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <span>Step 2</span>
            <Badge variant="outline" className="text-[10px] px-1.5">Requirements</Badge>
          </CardTitle>
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> {movie?.title}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Seat category ── */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Seat category</p>
          <div className="flex gap-1.5">
            {['REGULAR', 'VIP'].map(val => {
              const locked = categoryLocked;
              const active = category === val;
              return (
                <button
                  key={val}
                  disabled={locked}
                  onClick={() => handleCategoryChange(val)}
                  className={`flex-1 rounded-md py-2 text-xs font-medium border transition-colors ${
                    locked
                      ? 'opacity-40 cursor-not-allowed bg-secondary/40 border-border text-muted-foreground'
                      : active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {val === 'VIP' && <Star className="w-3 h-3 inline mr-1" />}
                  {val === 'REGULAR' ? 'Regular' : 'VIP'}
                </button>
              );
            })}
          </div>
          {categoryLocked && (
            <p className="text-[10px] text-amber-500/80 mt-1">Disabled seats are always Regular</p>
          )}
        </div>

        <Separator />

        {/* ── Seat type ── */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Seat type</p>
          <div className="flex gap-1.5">
            {['SINGLE', 'GROUP'].map(val => (
              <button
                key={val}
                onClick={() => handleSeatTypeChange(val)}
                className={`flex-1 rounded-md py-2 text-xs font-medium border transition-colors ${
                  seatType === val
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {val === 'GROUP' && <Users className="w-3 h-3 inline mr-1" />}
                {val === 'SINGLE' ? 'Single' : 'Group'}
              </button>
            ))}
          </div>
        </div>

        {/* ── No. of people (group only) ── */}
        {groupSelected && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              No. of people
              <span className="ml-1 text-[10px] text-muted-foreground/60">
                ({minPax}–{maxPax})
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePaxChange(pax - 1)}
                disabled={pax <= minPax}
                className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-sm disabled:opacity-40 hover:bg-secondary/70 transition-colors"
              >−</button>
              <select
                value={pax}
                onChange={e => handlePaxChange(e.target.value)}
                className="flex-1 rounded-md bg-secondary border border-border text-xs text-foreground px-2 py-1.5 text-center"
              >
                {Array.from({ length: maxPax - minPax + 1 }, (_, i) => i + minPax).map(n => (
                  <option key={n} value={n}>{n} people</option>
                ))}
              </select>
              <button
                onClick={() => handlePaxChange(pax + 1)}
                disabled={pax >= maxPax}
                className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-sm disabled:opacity-40 hover:bg-secondary/70 transition-colors"
              >+</button>
            </div>
          </div>
        )}

        <Separator />

        {/* ── Accessibility ── */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Accessibility</p>
          <div className="flex gap-1.5">
            {[{ val: false, label: 'No' }, { val: true, label: 'Yes – Disabled' }].map(({ val, label }) => {
              const locked = disabledLocked;
              const active = disabled === val;
              return (
                <button
                  key={String(val)}
                  disabled={locked}
                  onClick={() => handleDisabledChange(val)}
                  className={`flex-1 rounded-md py-2 text-xs font-medium border transition-colors ${
                    locked
                      ? 'opacity-40 cursor-not-allowed bg-secondary/40 border-border text-muted-foreground'
                      : active
                        ? val
                          ? 'bg-teal-600 text-white border-teal-500'
                          : 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {val && <Accessibility className="w-3 h-3 inline mr-1" />}
                  {label}
                </button>
              );
            })}
          </div>
          {disabledLocked && (
            <p className="text-[10px] text-amber-500/80 mt-1">VIP seats are not accessibility seats</p>
          )}
        </div>

        <Separator />

        {/* ── Summary pill ── */}
        <div className="rounded-lg bg-secondary/60 border border-border px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground text-xs mb-1">Booking summary</p>
          <p>Movie: <span className="text-foreground">{movie?.title}</span></p>
          <p>Type: <span className="text-foreground">{params.bookingType}</span></p>
          <p>Seats: <span className="text-foreground">{params.groupSize}</span></p>
        </div>

        <Button
          className="w-full"
          disabled={loading || !canBook}
          onClick={() => onBook(params)}
        >
          {loading ? 'Finding seats…' : 'Find best seats'}
        </Button>

      </CardContent>
    </Card>
  );
}

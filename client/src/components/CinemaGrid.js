import React from 'react';
import './CinemaGrid.css';

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

function getSeatColor(seat, isJustBooked) {
  if (isJustBooked) return 'justbooked';
  if (seat.type === 'BROKEN' || seat.status === 'BROKEN') return 'broken';
  if (seat.status === 'BOOKED') return 'booked';
  if (seat.type === 'VIP') return 'vip';
  if (seat.type === 'DISABILITY') return 'disability';
  return 'regular';
}

function CinemaGrid({ cinema, lastBooked }) {
  const bookedSet = new Set(lastBooked);

  return (
    <div className="cinema-wrap">
      <div className="screen">SCREEN</div>

      <div className="grid-area">
        {/* column numbers */}
        <div className="col-numbers">
          <span className="row-label"></span>
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className="col-num">{i + 1}</span>
          ))}
        </div>

        {cinema.map((row, rowIndex) => (
          <div key={rowIndex} className="cinema-row">
            <span className="row-label">{ROWS[rowIndex]}</span>
            {row.map((seat, colIndex) => {
              const seatId = `${seat.row}${seat.col}`;
              const colorClass = getSeatColor(seat, bookedSet.has(seatId));
              return (
                <div
                  key={colIndex}
                  className={`seat ${colorClass}`}
                  title={`${seat.row}${seat.col} - ${seat.type} - ${seat.status}`}
                />
              );
            })}
            <span className="row-label-right">{ROWS[rowIndex]}</span>
          </div>
        ))}
      </div>

      <div className="vip-label">VIP zone: rows E-I, cols 12-15</div>
    </div>
  );
}

export default CinemaGrid;

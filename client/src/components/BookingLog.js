import React from 'react';
import './BookingLog.css';

function BookingLog({ log }) {
  if (log.length === 0) return null;

  return (
    <div className="booking-log">
      <h3>Booking History</h3>
      <ul>
        {log.map((entry, i) => (
          <li key={i} className={i === 0 ? 'newest' : ''}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

export default BookingLog;

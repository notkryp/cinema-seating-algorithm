import React, { useState } from 'react';
import './BookingControls.css';

function BookingControls({ onBook, onReset, onStressTest }) {
  const [groupSize, setGroupSize] = useState(2);
  const [bookingType, setBookingType] = useState('NORMAL');
  const [adminOverride, setAdminOverride] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onBook(groupSize, bookingType, adminOverride);
  }

  return (
    <div className="controls">
      <h3>Book Seats</h3>
      <form onSubmit={handleSubmit}>
        <label>
          Group size
          <select
            value={groupSize}
            onChange={e => setGroupSize(parseInt(e.target.value))}
          >
            {[1,2,3,4,5,6,7].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
            ))}
          </select>
        </label>

        <label>
          Booking type
          <select
            value={bookingType}
            onChange={e => setBookingType(e.target.value)}
          >
            <option value="NORMAL">Normal</option>
            <option value="VIP">VIP</option>
            <option value="DISABILITY">Disability</option>
          </select>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={adminOverride}
            onChange={e => setAdminOverride(e.target.checked)}
          />
          Admin override (bypass rules)
        </label>

        <button type="submit" className="btn-book">Book Seats</button>
      </form>

      <button className="btn-stress" onClick={onStressTest}>
        Stress Test (half fill)
      </button>

      <button className="btn-reset" onClick={onReset}>
        Reset / New Session
      </button>
    </div>
  );
}

export default BookingControls;

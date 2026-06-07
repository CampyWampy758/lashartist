import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminFetchAvailability,
  adminFetchBookings,
  STATUS_LABELS,
} from "../api";

const ACTIVE_STATUSES = ["pending_deposit", "deposit_submitted", "approved"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

function isDayOpen(dateStr, schedule, blockedDates) {
  if (blockedDates.some((b) => b.date === dateStr)) return false;
  const slots = schedule[dayOfWeek(dateStr)] || [];
  return slots.some((s) => s.available);
}

function buildMonthCells(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDow; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  return cells;
}

export default function CalendarPanel({ token }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [blockedDates, setBlockedDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingData, availability] = await Promise.all([
        adminFetchBookings(token, { status: "all", sort: "date_asc" }),
        adminFetchAvailability(token),
      ]);
      setBookings(bookingData);
      setSchedule(availability.schedule);
      setBlockedDates(availability.blockedDates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const bookingsByDate = useMemo(() => {
    const map = new Map();
    for (const booking of bookings) {
      if (!ACTIVE_STATUSES.includes(booking.status)) continue;
      const list = map.get(booking.date) || [];
      list.push(booking);
      map.set(booking.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [bookings]);

  const monthCells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthStats = useMemo(() => {
    let booked = 0;
    let free = 0;
    let closed = 0;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = toDateKey(viewYear, viewMonth, day);
      if (!isDayOpen(dateStr, schedule, blockedDates)) {
        closed += 1;
      } else if ((bookingsByDate.get(dateStr) || []).length > 0) {
        booked += 1;
      } else {
        free += 1;
      }
    }
    return { booked, free, closed };
  }, [viewYear, viewMonth, schedule, blockedDates, bookingsByDate]);

  const selectedBookings = selectedDate ? bookingsByDate.get(selectedDate) || [] : [];

  function shiftMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setSelectedDate(null);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(toDateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  if (loading) return <p className="muted">Loading calendar...</p>;

  return (
    <div className="panel calendar-panel">
      <p className="muted panel-desc">
        See which days have appointments and which are still open. Closed days follow your weekly schedule and blocked dates.
      </p>
      {error && <p className="form-error">{error}</p>}

      <div className="calendar-toolbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)}>
          ← Prev
        </button>
        <h2 className="calendar-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)}>
          Next →
        </button>
      </div>

      <button type="button" className="btn btn-ghost btn-sm calendar-today-btn" onClick={goToday}>
        Today
      </button>

      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <i className="calendar-swatch calendar-swatch--booked" /> Booked
        </span>
        <span className="calendar-legend-item">
          <i className="calendar-swatch calendar-swatch--free" /> Free
        </span>
        <span className="calendar-legend-item">
          <i className="calendar-swatch calendar-swatch--closed" /> Closed
        </span>
      </div>

      <div className="calendar-stats">
        <div className="calendar-stat">
          <strong>{monthStats.booked}</strong>
          <span>booked days</span>
        </div>
        <div className="calendar-stat">
          <strong>{monthStats.free}</strong>
          <span>free days</span>
        </div>
        <div className="calendar-stat">
          <strong>{monthStats.closed}</strong>
          <span>closed days</span>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((name) => (
          <div key={name} className="calendar-weekday">{name}</div>
        ))}
        {monthCells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="calendar-day calendar-day--empty" />;
          }

          const dateStr = toDateKey(viewYear, viewMonth, day);
          const open = isDayOpen(dateStr, schedule, blockedDates);
          const dayBookings = bookingsByDate.get(dateStr) || [];
          const status = !open ? "closed" : dayBookings.length > 0 ? "booked" : "free";
          const isToday =
            viewYear === today.getFullYear() &&
            viewMonth === today.getMonth() &&
            day === today.getDate();
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              type="button"
              className={[
                "calendar-day",
                `calendar-day--${status}`,
                isToday ? "calendar-day--today" : "",
                isSelected ? "calendar-day--selected" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedDate(dateStr)}
            >
              <span className="calendar-day-num">{day}</span>
              {dayBookings.length > 0 && (
                <span className="calendar-day-count">{dayBookings.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="calendar-day-detail">
          <div className="calendar-day-detail-head">
            <h3>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>
              Close
            </button>
          </div>

          {!isDayOpen(selectedDate, schedule, blockedDates) && (
            <p className="muted">This day is closed (blocked or not on your weekly schedule).</p>
          )}

          {isDayOpen(selectedDate, schedule, blockedDates) && selectedBookings.length === 0 && (
            <p className="muted">No appointments — this day is free.</p>
          )}

          {selectedBookings.length > 0 && (
            <ul className="calendar-booking-list">
              {selectedBookings.map((b) => (
                <li key={b.id} className="calendar-booking-item">
                  <div>
                    <strong>{b.time}</strong>
                    <p>{b.clientName} · {b.serviceName}</p>
                    <p className="calendar-booking-ref">{b.reference}</p>
                  </div>
                  <span className={`status status-${b.status.replace(/_/g, "-")}`}>
                    {STATUS_LABELS[b.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

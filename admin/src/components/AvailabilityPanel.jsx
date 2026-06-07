import { useCallback, useEffect, useState } from "react";
import {
  adminAddBlockedDate,
  adminFetchAvailability,
  adminRemoveBlockedDate,
  adminUpdateSchedule,
  DAY_NAMES,
  TIME_SLOTS,
} from "../api";

function minDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function AvailabilityPanel({ token }) {
  const [schedule, setSchedule] = useState({});
  const [blockedDates, setBlockedDates] = useState([]);
  const [blockForm, setBlockForm] = useState({ date: "", reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminFetchAvailability(token);
      setSchedule(data.schedule);
      setBlockedDates(data.blockedDates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSlot(day, time) {
    setSchedule((prev) => {
      const daySlots = [...(prev[day] || [])];
      const idx = daySlots.findIndex((s) => s.time === time);
      if (idx >= 0) {
        daySlots[idx] = { ...daySlots[idx], available: !daySlots[idx].available };
      }
      return { ...prev, [day]: daySlots };
    });
  }

  async function saveSchedule() {
    setSaving(true);
    setError("");
    try {
      const updates = [];
      for (let day = 0; day <= 6; day += 1) {
        for (const slot of schedule[day] || []) {
          updates.push({
            dayOfWeek: day,
            timeSlot: slot.time,
            isAvailable: slot.available,
          });
        }
      }
      const result = await adminUpdateSchedule(token, updates);
      setSchedule(result.schedule);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBlockDate(e) {
    e.preventDefault();
    if (!blockForm.date) return;
    try {
      await adminAddBlockedDate(token, blockForm.date, blockForm.reason);
      setBlockForm({ date: "", reason: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnblock(id) {
    try {
      await adminRemoveBlockedDate(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading availability...</p>;

  return (
    <div className="panel">
      <p className="muted panel-desc">
        Set which days and time slots clients can book. Unavailable slots are hidden on the booking form.
      </p>
      {error && <p className="form-error">{error}</p>}

      <div className="schedule-grid">
        <div className="schedule-header">
          <span />
          {TIME_SLOTS.map((t) => (
            <span key={t} className="schedule-time-label">{t}</span>
          ))}
        </div>
        {DAY_NAMES.map((name, day) => (
          <div key={name} className="schedule-row">
            <span className="schedule-day-label">{name}</span>
            {TIME_SLOTS.map((time) => {
              const slot = schedule[day]?.find((s) => s.time === time);
              const available = slot?.available ?? false;
              return (
                <button
                  key={time}
                  type="button"
                  className={`slot-toggle ${available ? "slot-toggle--on" : ""}`}
                  onClick={() => toggleSlot(day, time)}
                  title={`${name} ${time}: ${available ? "available" : "closed"}`}
                >
                  {available ? "✓" : "—"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-primary" onClick={saveSchedule} disabled={saving}>
        {saving ? "Saving..." : "Save Schedule"}
      </button>

      <div className="blocked-section">
        <p className="block-label">Blocked dates</p>
        <form className="block-form" onSubmit={handleBlockDate}>
          <input
            type="date"
            min={minDate()}
            value={blockForm.date}
            onChange={(e) => setBlockForm((p) => ({ ...p, date: e.target.value }))}
            required
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={blockForm.reason}
            onChange={(e) => setBlockForm((p) => ({ ...p, reason: e.target.value }))}
          />
          <button type="submit" className="btn btn-ghost btn-sm">Block date</button>
        </form>
        {blockedDates.length === 0 ? (
          <p className="muted">No blocked dates.</p>
        ) : (
          <ul className="blocked-list">
            {blockedDates.map((b) => (
              <li key={b.id}>
                <span>{b.date}{b.reason ? ` — ${b.reason}` : ""}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleUnblock(b.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

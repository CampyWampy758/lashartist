import { useCallback, useEffect, useState } from "react";
import {
  adminFetchBookings,
  adminFetchStats,
  adminUpdateBooking,
  formatEC,
  STATUS_LABELS,
  TIME_SLOTS,
} from "./api";
import DepositProof from "./components/DepositProof";
import AvailabilityPanel from "./components/AvailabilityPanel";
import CalendarPanel from "./components/CalendarPanel";
import PromosPanel from "./components/PromosPanel";
import UsersPanel from "./components/UsersPanel";
import "./App.css";

const TOKEN_KEY = "liyelle_admin_token";

const FILTERS = [
  { id: "deposit_submitted", label: "Needs review" },
  { id: "pending_deposit", label: "Awaiting deposit" },
  { id: "approved", label: "Confirmed" },
  { id: "rejected", label: "Declined" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const SECTIONS = [
  { id: "bookings", label: "Bookings" },
  { id: "calendar", label: "Calendar" },
  { id: "availability", label: "Availability" },
  { id: "promos", label: "Promos" },
  { id: "users", label: "Users" },
];

function minDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("deposit_submitted");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [reschedule, setReschedule] = useState({});

  const loadData = useCallback(async (authToken) => {
    setLoading(true);
    setError("");
    try {
      const [bookingData, statsData] = await Promise.all([
        adminFetchBookings(authToken, { status: filter, search, sort }),
        adminFetchStats(authToken),
      ]);
      setBookings(bookingData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
      if (err.message === "Unauthorized") {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search, sort]);

  useEffect(() => {
    if (token && section === "bookings") loadData(token);
  }, [token, section, loadData]);

  function handleLogin(e) {
    e.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem(TOKEN_KEY, password.trim());
    setToken(password.trim());
    setPassword("");
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setBookings([]);
    setStats(null);
  }

  async function review(id, status) {
    try {
      await adminUpdateBooking(token, id, {
        status,
        adminNotes: notes[id] || "",
      });
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return;
    try {
      await adminUpdateBooking(token, id, { status: "cancelled" });
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveReschedule(id) {
    const data = reschedule[id];
    if (!data?.date || !data?.time) {
      setError("Pick a new date and time to reschedule.");
      return;
    }
    try {
      await adminUpdateBooking(token, id, {
        date: data.date,
        time: data.time,
        adminNotes: notes[id] || "",
      });
      setReschedule((prev) => ({ ...prev, [id]: undefined }));
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNotes(id) {
    try {
      await adminUpdateBooking(token, id, { adminNotes: notes[id] || "" });
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) {
    return (
      <div className="admin-shell">
        <div className="login-panel">
          <p className="eyebrow">Staff portal</p>
          <h1>Liyelle Admin</h1>
          <p className="muted">Review deposits and manage salon bookings.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter admin password"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block">Sign in</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">The Liyelle Atelier</p>
          <h1>Admin dashboard</h1>
        </div>
        <div className="header-actions">
          {section === "bookings" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadData(token)} disabled={loading}>
              Refresh
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="section-nav">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "bookings" && (
        <>
          {stats && (
            <div className="stats-grid">
              <div className="stat-card stat-card--highlight">
                <span className="stat-label">Needs review</span>
                <strong className="stat-value">{stats.deposit_submitted}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Awaiting deposit</span>
                <strong className="stat-value">{stats.pending_deposit}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Confirmed</span>
                <strong className="stat-value">{stats.approved}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Deposits collected</span>
                <strong className="stat-value">{formatEC(stats.depositsApproved)}</strong>
              </div>
            </div>
          )}

          <div className="toolbar">
            <input
              type="search"
              className="search-input"
              placeholder="Search name, phone, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_desc">Newest first</option>
              <option value="date_asc">Appointment soonest</option>
              <option value="date_desc">Appointment latest</option>
            </select>
          </div>

          <div className="filter-tabs">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
                {stats && id !== "all" && stats[id] > 0 && (
                  <span className="tab-count">{stats[id]}</span>
                )}
              </button>
            ))}
          </div>

          {loading && <p className="muted">Loading bookings...</p>}
          {error && <p className="form-error">{error}</p>}

          <div className="booking-list">
            {bookings.length === 0 && !loading && (
              <p className="empty-state">No bookings in this view.</p>
            )}
            {bookings.map((booking) => {
              const isOpen = expanded === booking.id;
              const rs = reschedule[booking.id] || { date: booking.date, time: booking.time };

              return (
                <article key={booking.id} className={`booking-card ${isOpen ? "booking-card--open" : ""}`}>
                  <button
                    type="button"
                    className="booking-card__toggle"
                    onClick={() => setExpanded(isOpen ? null : booking.id)}
                  >
                    <div className="booking-card__head">
                      <div>
                        <strong>{booking.reference}</strong>
                        <p>{booking.clientName} · {booking.phone}</p>
                      </div>
                      <span className={`status status-${booking.status.replace(/_/g, "-")}`}>
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </div>
                    <dl className="meta meta--compact">
                      <div><dt>Service</dt><dd>{booking.serviceName}</dd></div>
                      <div><dt>When</dt><dd>{booking.date} · {booking.time}</dd></div>
                      <div><dt>Deposit</dt><dd>{formatEC(booking.depositAmount)}</dd></div>
                    </dl>
                  </button>

                  {isOpen && (
                    <div className="booking-card__body">
                      <dl className="meta">
                        <div><dt>Total</dt><dd>{formatEC(booking.servicePrice)}</dd></div>
                        <div><dt>Balance due</dt><dd>{formatEC(booking.balanceDue)}</dd></div>
                        {booking.promoCode && (
                          <div><dt>Promo</dt><dd>{booking.promoCode} (−{formatEC(booking.discountAmount || 0)})</dd></div>
                        )}
                        {booking.email && <div><dt>Email</dt><dd>{booking.email}</dd></div>}
                        {booking.notes && <div><dt>Client notes</dt><dd>{booking.notes}</dd></div>}
                        {booking.expiresAt && booking.status === "pending_deposit" && (
                          <div><dt>Hold expires</dt><dd>{new Date(booking.expiresAt).toLocaleString()}</dd></div>
                        )}
                        {booking.depositSubmittedAt && (
                          <div><dt>Deposit sent</dt><dd>{new Date(booking.depositSubmittedAt).toLocaleString()}</dd></div>
                        )}
                        {booking.adminNotes && (
                          <div><dt>Internal notes</dt><dd>{booking.adminNotes}</dd></div>
                        )}
                      </dl>

                      {booking.depositProof && (
                        <DepositProof token={token} bookingId={booking.id} />
                      )}

                      <div className="notes-block">
                        <label>
                          Internal notes
                          <textarea
                            rows={2}
                            placeholder="Notes visible only to staff"
                            value={notes[booking.id] ?? booking.adminNotes ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          />
                        </label>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveNotes(booking.id)}>
                          Save notes
                        </button>
                      </div>

                      {["approved", "pending_deposit", "deposit_submitted"].includes(booking.status) && (
                        <div className="reschedule-block">
                          <p className="block-label">Reschedule</p>
                          <div className="reschedule-fields">
                            <input
                              type="date"
                              min={minDate()}
                              value={rs.date}
                              onChange={(e) =>
                                setReschedule((prev) => ({
                                  ...prev,
                                  [booking.id]: { ...rs, date: e.target.value },
                                }))
                              }
                            />
                            <select
                              value={rs.time}
                              onChange={(e) =>
                                setReschedule((prev) => ({
                                  ...prev,
                                  [booking.id]: { ...rs, time: e.target.value },
                                }))
                              }
                            >
                              {TIME_SLOTS.map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveReschedule(booking.id)}>
                              Update slot
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="card-actions">
                        {booking.status === "deposit_submitted" && (
                          <div className="review-btns">
                            <button type="button" className="btn btn-accept" onClick={() => review(booking.id, "approved")}>
                              Approve
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => review(booking.id, "rejected")}>
                              Decline
                            </button>
                          </div>
                        )}
                        {booking.status !== "cancelled" && booking.status !== "rejected" && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancelBooking(booking.id)}>
                            Cancel booking
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {section === "calendar" && <CalendarPanel token={token} />}
      {section === "availability" && <AvailabilityPanel token={token} />}
      {section === "promos" && <PromosPanel token={token} />}
      {section === "users" && <UsersPanel token={token} />}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  adminFetchBookings,
  adminFetchStats,
  adminGetSession,
  adminSignIn,
  adminSignOut,
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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
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

  useEffect(() => {
    adminGetSession()
      .then(setSession)
      .finally(() => setAuthLoading(false));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingData, statsData] = await Promise.all([
        adminFetchBookings({ status: filter, search, sort }),
        adminFetchStats(),
      ]);
      setBookings(bookingData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("Sign in") || err.message.includes("Admin access")) {
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search, sort]);

  useEffect(() => {
    if (session && section === "bookings") loadData();
  }, [session, section, loadData]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      await adminSignIn(email.trim(), password);
      const next = await adminGetSession();
      setSession(next);
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await adminSignOut();
    setSession(null);
    setBookings([]);
    setStats(null);
  }

  async function review(id, status) {
    try {
      await adminUpdateBooking(id, {
        status,
        adminNotes: notes[id] || "",
      });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return;
    try {
      await adminUpdateBooking(id, { status: "cancelled" });
      await loadData();
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
      await adminUpdateBooking(id, {
        date: data.date,
        time: data.time,
        adminNotes: notes[id] || "",
      });
      setReschedule((prev) => ({ ...prev, [id]: undefined }));
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNotes(id) {
    try {
      await adminUpdateBooking(id, { adminNotes: notes[id] || "" });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (authLoading) {
    return (
      <div className="admin-shell">
        <div className="login-panel">
          <p className="muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-shell">
        <div className="login-panel">
          <p className="eyebrow">Staff portal</p>
          <h1>Liyelle Admin</h1>
          <p className="muted">Sign in with your admin Supabase account.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="admin@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
                required
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
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
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
                        <DepositProof bookingId={booking.id} />
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

      {section === "calendar" && <CalendarPanel />}
      {section === "availability" && <AvailabilityPanel />}
      {section === "promos" && <PromosPanel />}
      {section === "users" && <UsersPanel />}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { fetchMyBookings, STATUS_LABELS } from "../api";

export default function Appointments() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyBookings();
      setBookings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/sign-in");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) loadBookings();
  }, [user, loadBookings]);

  if (authLoading || !user) {
    return <div className="page centered"><p className="muted">Loading...</p></div>;
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="My Account"
        title="Appointments"
        subtitle="View and manage your bookings."
      />

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}

      {!loading && (
        <section className="section">
          {bookings.length === 0 ? (
            <p className="muted">No appointments yet. <Link to="/book">Book an appointment</Link></p>
          ) : (
            <div className="stack">
              {bookings.map((b) => (
                <Link key={b.id} to={`/booking/${b.id}`} className="account-booking-card">
                  <div>
                    <strong>{b.reference}</strong>
                    <p>{b.serviceName} · {b.date} · {b.time}</p>
                  </div>
                  <span className={`status-pill status-${b.status.replace(/_/g, "-")}`}>
                    {STATUS_LABELS[b.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchBanks,
  fetchBooking,
  fetchSettings,
  formatEC,
  STATUS_LABELS,
  uploadDepositProof,
} from "../api";

export default function BookingDetail() {
  const { id } = useParams();
  const fileRef = useRef(null);
  const [booking, setBooking] = useState(null);
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([fetchBooking(id), fetchBanks(), fetchSettings()])
      .then(([b, bnk, cfg]) => {
        setBooking(b);
        setBanks(bnk);
        setSettings(cfg);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a screenshot of your transfer.");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const updated = await uploadDepositProof(id, file);
      setBooking(updated);
      setSuccess("Deposit proof received. We'll review and confirm your booking.");
      fileRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (error && !booking) {
    return (
      <div className="page centered">
        <p className="form-error">{error}</p>
        <Link to="/book#booking-form" className="btn btn-primary">Book again</Link>
      </div>
    );
  }

  if (!booking) {
    return <div className="page centered"><p className="muted">Loading booking...</p></div>;
  }

  const preferredBank = banks.find((b) => b.id === booking.preferredBankId);
  const displayBanks = preferredBank ? [preferredBank] : banks;
  const canUpload = ["pending_deposit", "deposit_submitted"].includes(booking.status);
  const statusClass = booking.status.replace(/_/g, "-");
  const holdExpires = booking.expiresAt ? new Date(booking.expiresAt) : null;
  const holdActive = holdExpires && holdExpires > new Date() && booking.status === "pending_deposit";

  return (
    <div className="page booking-detail">
      <header className="booking-header">
        <p className="eyebrow">Booking Reference</p>
        <h1>{booking.reference}</h1>
        <span className={`status-pill status-${statusClass}`}>
          {STATUS_LABELS[booking.status] || booking.status}
        </span>
      </header>

      <section className="summary-card">
        <dl>
          <div><dt>Service</dt><dd>{booking.serviceName}</dd></div>
          <div><dt>Date</dt><dd>{booking.date}</dd></div>
          <div><dt>Time</dt><dd>{booking.time}</dd></div>
          <div><dt>Total</dt><dd>{formatEC(booking.servicePrice)}</dd></div>
          <div><dt>Deposit ({booking.depositPercent}%)</dt><dd>{formatEC(booking.depositAmount)}</dd></div>
          <div><dt>Balance due</dt><dd>{formatEC(booking.balanceDue)}</dd></div>
        </dl>
      </section>

      {booking.status === "approved" && (
        <div className="alert alert-success">
          Your appointment is confirmed. See you at the studio!
        </div>
      )}

      {booking.status === "rejected" && (
        <div className="alert alert-error">
          This booking was declined. Please contact us on WhatsApp if you have questions.
        </div>
      )}

      {booking.status === "deposit_submitted" && (
        <div className="alert alert-info">
          Deposit received — awaiting admin approval. We&apos;ll confirm via WhatsApp or email.
        </div>
      )}

      {booking.status === "expired" && (
        <div className="alert alert-error">
          Your deposit hold has expired and this slot was released. Please book again to reserve a new time.
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="alert alert-error">
          This booking was cancelled. Contact the studio if you need help rebooking.
        </div>
      )}

      {holdActive && (
        <div className="alert alert-info">
          Complete your deposit by {holdExpires.toLocaleString()} to keep this slot reserved.
        </div>
      )}

      {canUpload && (
        <>
          <section className="section">
            <h2 className="section-title">Pay Deposit via Mobile Banking</h2>
            <ol className="steps compact">
              <li>Open your bank app (BOSL, CIBC, 1st National, or Republic)</li>
              <li>Transfer exactly <strong>{formatEC(booking.depositAmount)}</strong></li>
              <li>Use reference: <strong>{booking.reference}</strong></li>
              <li>Screenshot the confirmation screen</li>
              <li>Upload below — admin will approve your slot</li>
            </ol>
          </section>

          <section className="bank-list">
            {displayBanks.map((bank) => (
              <article key={bank.id} className="bank-card">
                <h3>{bank.name}</h3>
                <dl>
                  <div><dt>Account name</dt><dd>{bank.accountName}</dd></div>
                  <div>
                    <dt>Account number</dt>
                    <dd>{bank.accountNumber || "Contact studio for details"}</dd>
                  </div>
                  {bank.branch && (
                    <div><dt>Branch</dt><dd>{bank.branch}</dd></div>
                  )}
                </dl>
              </article>
            ))}
          </section>

          <form className="upload-form" onSubmit={handleUpload}>
            <label>
              Upload transfer screenshot
              <input ref={fileRef} type="file" accept="image/*" />
            </label>
            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
              {uploading ? "Uploading..." : "Submit Deposit Proof"}
            </button>
          </form>
        </>
      )}

      <div className="booking-footer">
        <Link to="/" className="btn btn-ghost">Back to Home</Link>
        {settings?.whatsapp && (
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, my booking reference is ${booking.reference}`)}`}
            className="btn btn-outline"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Studio
          </a>
        )}
      </div>
    </div>
  );
}

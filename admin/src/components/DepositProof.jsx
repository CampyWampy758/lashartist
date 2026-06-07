import { useEffect, useState } from "react";
import { adminFetchDepositProofUrl } from "../api";

export default function DepositProof({ bookingId }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");

    adminFetchDepositProofUrl(bookingId)
      .then(setUrl)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) return <p className="muted">Loading screenshot...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!url) return null;

  return (
    <div className="proof-preview">
      <p className="block-label">Deposit screenshot</p>
      <a href={url} target="_blank" rel="noreferrer" className="proof-link">
        Open full size →
      </a>
      <img src={url} alt="Deposit transfer screenshot" className="proof-image" />
    </div>
  );
}

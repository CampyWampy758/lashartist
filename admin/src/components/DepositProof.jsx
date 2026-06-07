import { useEffect, useState } from "react";
import { adminFetchDepositProof } from "../api";

export default function DepositProof({ token, bookingId }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl = null;
    setLoading(true);
    setError("");

    adminFetchDepositProof(token, bookingId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, bookingId]);

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

import { useCallback, useEffect, useState } from "react";
import { adminCreatePromo, adminFetchPromos, adminUpdatePromo } from "../api";

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: 10,
  maxUses: "",
  minOrderAmount: 0,
  expiresAt: "",
};

export default function PromosPanel() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPromos(await adminFetchPromos());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await adminCreatePromo({
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        expiresAt: form.expiresAt || null,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(promo) {
    try {
      await adminUpdatePromo(promo.id, { isActive: !promo.isActive });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading promo codes...</p>;

  return (
    <div className="panel">
      {error && <p className="form-error">{error}</p>}

      <form className="promo-form" onSubmit={handleCreate}>
        <p className="block-label">Create promo code</p>
        <div className="promo-form-grid">
          <label>
            Code
            <input
              required
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="SUMMER20"
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Summer discount"
            />
          </label>
          <label>
            Type
            <select
              value={form.discountType}
              onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount (EC$)</option>
            </select>
          </label>
          <label>
            Value
            <input
              type="number"
              required
              min={1}
              value={form.discountValue}
              onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
            />
          </label>
          <label>
            Max uses
            <input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.maxUses}
              onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
            />
          </label>
          <label>
            Min order (EC$)
            <input
              type="number"
              min={0}
              value={form.minOrderAmount}
              onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: e.target.value }))}
            />
          </label>
          <label>
            Expires
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
            />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Creating..." : "Create Promo"}
        </button>
      </form>

      <div className="promo-list">
        <p className="block-label">All promo codes</p>
        {promos.length === 0 ? (
          <p className="muted">No promo codes yet.</p>
        ) : (
          promos.map((p) => (
            <article key={p.id} className={`promo-card ${p.isActive ? "" : "promo-card--inactive"}`}>
              <div className="promo-card__head">
                <strong>{p.code}</strong>
                <span className={`status ${p.isActive ? "status-approved" : "status-cancelled"}`}>
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="muted">{p.description || "No description"}</p>
              <dl className="meta meta--compact">
                <div>
                  <dt>Discount</dt>
                  <dd>{p.discountType === "percent" ? `${p.discountValue}%` : `EC$${p.discountValue}`}</dd>
                </div>
                <div>
                  <dt>Uses</dt>
                  <dd>{p.useCount}{p.maxUses ? ` / ${p.maxUses}` : ""}</dd>
                </div>
                {p.expiresAt && (
                  <div>
                    <dt>Expires</dt>
                    <dd>{new Date(p.expiresAt).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(p)}>
                {p.isActive ? "Deactivate" : "Activate"}
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

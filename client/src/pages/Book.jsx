import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ServiceCard from "../components/ServiceCard";
import { scrollToBookingForm } from "../utils/scroll";
import { useAuth } from "../context/AuthContext";
import {
  createBooking,
  fetchAvailability,
  fetchBanks,
  fetchServices,
  fetchSettings,
  formatEC,
  validatePromoCode,
} from "../api";

function minDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function Book() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const preselected = params.get("service");
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    date: "",
    time: "",
    clientName: "",
    phone: "",
    email: "",
    notes: "",
    preferredBankId: "",
    promoCode: "",
  });
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchServices(), fetchBanks(), fetchSettings()])
      .then(([svc, bnk, cfg]) => {
        setServices(svc);
        setBanks(bnk);
        setSettings(cfg);
        if (preselected) {
          const match = svc.find((s) => s.id === preselected);
          if (match) setSelected(match);
        }
      })
      .catch(() => setError("Could not load booking form."));
  }, [preselected]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        clientName: prev.clientName || user.user_metadata?.full_name || "",
        phone: prev.phone || user.user_metadata?.phone || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (location.hash === "#booking-form") {
      scrollToBookingForm();
    }
  }, [location]);

  useEffect(() => {
    if (!form.date) {
      setAvailableSlots([]);
      return;
    }
    setSlotsLoading(true);
    fetchAvailability(form.date)
      .then((data) => {
        const open = data.slots.filter((s) => s.available).map((s) => s.time);
        setAvailableSlots(open);
        setForm((prev) => {
          if (prev.time && !data.slots.find((s) => s.time === prev.time && s.available)) {
            return { ...prev, time: "" };
          }
          return prev;
        });
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [form.date]);

  useEffect(() => {
    setPromoApplied(null);
    setPromoError("");
  }, [selected?.id]);

  const priceAfterPromo = useMemo(() => {
    if (!selected) return 0;
    return promoApplied ? promoApplied.finalPrice : selected.price;
  }, [selected, promoApplied]);

  const depositAmount = useMemo(() => {
    if (!selected || !settings) return 0;
    return Math.round(priceAfterPromo * (settings.depositPercent / 100));
  }, [selected, settings, priceAfterPromo]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function applyPromo() {
    if (!selected || !form.promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const result = await validatePromoCode(form.promoCode, selected.id);
      setPromoApplied(result);
    } catch (err) {
      setPromoApplied(null);
      setPromoError(err.message);
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) {
      setError("Please select a service.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const booking = await createBooking({
        serviceId: selected.id,
        ...form,
        promoCode: promoApplied ? form.promoCode : undefined,
      });
      navigate(`/booking/${booking.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reserve"
        title="Book Appointment"
        subtitle={`Salon studio bookings require a ${settings?.depositPercent ?? 50}% deposit. Admin approval after payment review.`}
      />

      {!user && (
        <p className="auth-hint">
          <a href="/sign-up">Create an account</a> to track bookings and get notifications.
        </p>
      )}

      <section className="section">
        <h2 className="section-title">1. Choose Service</h2>
        <div className="stack">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={selected?.id === service.id}
              onSelect={setSelected}
            />
          ))}
        </div>
      </section>

      {selected && settings && (
        <div className="deposit-preview">
          {promoApplied && (
            <span className="promo-savings">
              Promo {promoApplied.code}: −{formatEC(promoApplied.discountAmount)}
            </span>
          )}
          <span>Deposit due ({settings.depositPercent}%)</span>
          <strong>{formatEC(depositAmount)}</strong>
          <span className="muted">Balance at appointment: {formatEC(priceAfterPromo - depositAmount)}</span>
        </div>
      )}

      <form id="booking-form" className="booking-form section" onSubmit={handleSubmit}>
        <h2 className="section-title">2. Date & Details</h2>

        <label>
          Preferred date
          <input
            type="date"
            required
            min={minDate()}
            value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
          />
        </label>

        <label>
          Preferred time
          <select
            required
            value={form.time}
            disabled={!form.date || slotsLoading}
            onChange={(e) => updateField("time", e.target.value)}
          >
            <option value="">
              {!form.date ? "Pick a date first" : slotsLoading ? "Loading slots..." : "Select a time"}
            </option>
            {availableSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </label>
        {form.date && !slotsLoading && availableSlots.length === 0 && (
          <p className="form-error">No slots available on this date. Please choose another day.</p>
        )}

        <div className="promo-row">
          <label>
            Promo code (optional)
            <input
              type="text"
              placeholder="Enter code"
              value={form.promoCode}
              onChange={(e) => updateField("promoCode", e.target.value.toUpperCase())}
            />
          </label>
          <button
            type="button"
            className="btn btn-accept"
            onClick={applyPromo}
            disabled={!form.promoCode.trim() || !selected || promoLoading}
          >
            {promoLoading ? "..." : "Apply"}
          </button>
        </div>
        {promoError && <p className="form-error">{promoError}</p>}
        {promoApplied && <p className="form-success">Promo applied: {promoApplied.description || promoApplied.code}</p>}

        <label>
          Full name
          <input
            type="text"
            required
            autoComplete="name"
            value={form.clientName}
            onChange={(e) => updateField("clientName", e.target.value)}
          />
        </label>

        <label>
          Phone / WhatsApp
          <input
            type="tel"
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </label>

        <label>
          Email (optional)
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </label>

        <label>
          Pay deposit via
          <select
            value={form.preferredBankId}
            onChange={(e) => updateField("preferredBankId", e.target.value)}
          >
            <option value="">Any listed bank</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </select>
        </label>

        <label>
          Notes (optional)
          <textarea
            rows={3}
            placeholder="Allergies, desired look, first-time client..."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Submitting..." : "Continue to Deposit"}
        </button>
      </form>
    </div>
  );
}

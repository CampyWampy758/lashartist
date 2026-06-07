import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { fetchSettings } from "../api";

export default function Contact() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings().then(setSettings).catch(console.error);
  }, []);

  const whatsappUrl = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hi The Liyelle Atelier, I'd like to enquire about lash services.")}`
    : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Visit Us"
        title="Contact"
        subtitle="Our salon studio in Saint Lucia — we'd love to hear from you."
      />

      <div className="contact-cards">
        <article className="contact-card">
          <h3>Studio Location</h3>
          <p>{settings?.address || "Vieux-Fort, Saint Lucia"}</p>
          <p className="muted">{settings?.studioType || "Salon Studio"}</p>
        </article>

        <article className="contact-card">
          <h3>Hours</h3>
          <p>{settings?.hours || "Tue–Sat · 9:00 AM – 6:00 PM"}</p>
        </article>

        {settings?.email && (
          <article className="contact-card">
            <h3>Email</h3>
            <a href={`mailto:${settings.email}`}>{settings.email}</a>
          </article>
        )}

        {settings?.instagram && (
          <article className="contact-card">
            <h3>Instagram</h3>
            <a
              href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
            >
              @{settings.instagram.replace("@", "")}
            </a>
          </article>
        )}
      </div>

      <div className="contact-actions">
        {whatsappUrl && (
          <a href={whatsappUrl} className="btn btn-primary btn-block" target="_blank" rel="noreferrer">
            Message on WhatsApp
          </a>
        )}
        <Link to="/book#booking-form" className="btn btn-outline btn-block">
          Book Online
        </Link>
        <Link to="/policies" className="btn btn-ghost btn-block">
          Read Policies
        </Link>
      </div>
    </div>
  );
}

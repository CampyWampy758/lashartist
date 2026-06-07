import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import ServiceCard from "../components/ServiceCard";
import { fetchServices, fetchSettings } from "../api";

export default function Home() {
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchServices().then(setServices).catch(console.error);
    fetchSettings().then(setSettings).catch(console.error);
  }, []);

  const featured = services.filter((s) => ["hybrid", "volume", "mega-volume"].includes(s.id));

  return (
    <div className="page home-page">
      <section className="hero">
        <p className="eyebrow">Salon Studio · Vieux-Fort</p>
        <Logo />
        <p className="hero-tagline">
          Where soft glam meets high fashion — luxury lash artistry in our Vieux-Fort studio.
        </p>
        <div className="hero-actions">
          <Link to="/book#booking-form" className="btn btn-primary">
            Book Now
          </Link>
          <Link to="/services" className="btn btn-ghost">
            View Menu
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="dual-vibe">
          <div className="vibe-panel soft">
            <h2>Soft Glam</h2>
            <p>Natural texture, effortless flutter — perfect for everyday elegance.</p>
          </div>
          <div className="vibe-panel fashion">
            <h2>High Fashion</h2>
            <p>Editorial density and drama — camera-ready, statement lashes.</p>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <h2 className="section-title">Signature Sets</h2>
          <div className="stack">
            {featured.map((service) => (
              <ServiceCard key={service.id} service={service} showBook />
            ))}
          </div>
        </section>
      )}

      <section className="section steps-card">
        <h2 className="section-title">How Booking Works</h2>
        <ol className="steps">
          <li>Choose your service & preferred time</li>
          <li>Pay your {settings?.depositPercent ?? 50}% deposit via BOSL, CIBC, 1st National, or Republic</li>
          <li>Upload your transfer screenshot</li>
          <li>We review & confirm your appointment</li>
        </ol>
      </section>

      <section className="section cta-banner">
        <h2>Ready for your close-up?</h2>
        <p>Visit our salon studio for a bespoke lash experience.</p>
        <Link to="/gallery" className="btn btn-outline">
          View Gallery
        </Link>
      </section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { formatEC } from "../api";

export default function ServiceCard({ service, onSelect, selected, showBook = false }) {
  return (
    <article className={`service-card vibe-${service.vibe}${selected ? " service-card--selected" : ""}`}>
      <div className="service-card__top">
        <span className="vibe-badge">{service.vibe === "high-fashion" ? "High Fashion" : "Soft Glam"}</span>
        <h3>{service.name}</h3>
        <p className="service-tagline">{service.tagline}</p>
      </div>
      <p className="service-desc">{service.description}</p>
      <div className="service-meta">
        <span>{service.duration}</span>
        <strong>{formatEC(service.price)}</strong>
      </div>
      {onSelect && (
        <button
          type="button"
          className={`btn ${selected ? "btn-accept" : "btn-outline"}`}
          onClick={() => onSelect(service)}
        >
          {selected ? "Selected" : "Select"}
        </button>
      )}
      {showBook && (
        <Link to={`/book?service=${service.id}#booking-form`} className="btn btn-outline">
          Book this
        </Link>
      )}
    </article>
  );
}

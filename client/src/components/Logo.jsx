import { Link } from "react-router-dom";

export default function Logo({ compact = false }) {
  return (
    <Link to="/" className={`logo-mark ${compact ? "logo-mark--compact" : ""}`}>
      <span className="logo-script">Liyelle</span>
      {!compact && <span className="logo-serif">The Atelier</span>}
    </Link>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import { scrollToBookingForm } from "../utils/scroll";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/book#booking-form", label: "Book" },
  { to: "/contact", label: "Contact" },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, supabaseConfigured } = useAuth();
  const minimalChrome = pathname.startsWith("/booking/");
  const onBookPage = pathname === "/book";
  const hideBookCta = minimalChrome || onBookPage;
  const authPages = ["/sign-in", "/sign-up", "/reset-password"].includes(pathname);

  function handleBookClick(e) {
    if (onBookPage) {
      e.preventDefault();
      scrollToBookingForm();
    }
  }

  return (
    <div className={`layout ${user && !hideBookCta ? "" : "layout--no-cta"}`}>
      {!minimalChrome && (
        <header className="site-header">
          <Logo compact />
          {supabaseConfigured && !authPages && (
            <div className="header-auth">
              {user ? (
                <>
                  <NotificationBell />
                  <UserMenu />
                </>
              ) : (
                <NavLink to="/sign-in" className="header-auth-link">Sign In</NavLink>
              )}
            </div>
          )}
        </header>
      )}
      <main className="site-main">{children}</main>
      {!hideBookCta && user && (
        <div className="sticky-cta">
          <NavLink
            to="/book#booking-form"
            onClick={handleBookClick}
            className="btn btn-primary btn-block"
          >
            Book Appointment
          </NavLink>
        </div>
      )}
      {!minimalChrome && (
        <nav className="bottom-nav" aria-label="Main">
          {links.map(({ to, label, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onClick={to.includes("book") ? handleBookClick : undefined}
              className={({ isActive }) =>
                (isActive || (label === "Book" && onBookPage)) ? "active" : ""
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

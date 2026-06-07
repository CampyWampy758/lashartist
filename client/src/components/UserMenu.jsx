import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function displayName(user) {
  const name = user?.user_metadata?.full_name?.trim();
  if (name) return name.split(" ")[0];
  return user?.email?.split("@")[0] || "there";
}

export default function UserMenu() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  const firstName = displayName(user);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate("/");
  }

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        type="button"
        className="header-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Hi, {firstName}
        <span className="header-menu-chevron" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="header-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => go("/account")}>
            My Account
          </button>
          <button type="button" role="menuitem" onClick={() => go("/appointments")}>
            Appointments
          </button>
          <button type="button" role="menuitem" className="header-dropdown-danger" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
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

  async function handleNotificationClick(notification) {
    if (!notification.read) {
      await markRead(notification.id);
    }
    setOpen(false);
    if (notification.bookingId) {
      navigate(`/booking/${notification.bookingId}`);
    }
  }

  return (
    <div className="header-menu header-bell" ref={rootRef}>
      <button
        type="button"
        className="header-bell-trigger"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="header-bell-icon" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2a5 5 0 0 0-5 5v2.1c0 .9-.3 1.8-.9 2.5L4.3 14.2A1 1 0 0 0 5.2 16h13.6a1 1 0 0 0 .9-1.5l-1.8-2.6a4.4 4.4 0 0 1-.9-2.5V7a5 5 0 0 0-5-5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M10 18a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="header-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="header-dropdown header-notifications-panel">
          <div className="header-notifications-head">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button type="button" className="header-notifications-mark" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {loading && <p className="header-notifications-empty">Loading...</p>}

          {!loading && notifications.length === 0 && (
            <p className="header-notifications-empty">No updates yet.</p>
          )}

          {!loading && notifications.length > 0 && (
            <div className="header-notifications-list">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`header-notification-item ${n.read ? "" : "header-notification-item--unread"}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <strong>{n.title}</strong>
                  <span>{n.message}</span>
                  <time>{new Date(n.createdAt).toLocaleString()}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

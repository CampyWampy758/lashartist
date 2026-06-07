import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(async (id) => {
    if (!user) return;
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}

import { Router } from "express";
import { userAuth } from "../middleware/userAuth.js";
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/notifications.js";
import { supabaseEnabled } from "../utils/supabase.js";

const router = Router();

router.use(userAuth);

router.get("/", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.json([]);
    }
    const notifications = await getUserNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load notifications." });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: "Notifications require Supabase." });
    }
    const notification = await markNotificationRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notification." });
  }
});

router.post("/read-all", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: "Notifications require Supabase." });
    }
    await markAllNotificationsRead(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notifications." });
  }
});

export default router;

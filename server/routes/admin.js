import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { adminAuth } from "../middleware/adminAuth.js";
import { TIME_SLOTS } from "../data/constants.js";
import { readBookings, updateBooking, findBooking } from "../utils/storage.js";
import {
  expireStaleBookings,
  filterBookings,
  computeStats,
  isSlotConflict,
} from "../utils/bookings.js";
import {
  getWeeklySchedule,
  updateWeeklySchedule,
  getBlockedDates,
  addBlockedDate,
  removeBlockedDate,
  isSlotAdminAvailable,
} from "../utils/availability.js";
import { notifyAdminBooking } from "../utils/adminMail.js";
import { notifyClientBooking } from "../utils/clientMail.js";
import { notifyBookingUpdate } from "../utils/notifications.js";
import { listPromoCodes, createPromoCode, updatePromoCode } from "../utils/promos.js";
import {
  listUsers,
  deleteUserAccount,
  adminSendPasswordReset,
} from "../utils/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");

const router = Router();

router.use(adminAuth);

router.get("/stats", async (_req, res) => {
  try {
    await expireStaleBookings();
    const bookings = await readBookings();
    res.json(computeStats(bookings));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load stats." });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    await expireStaleBookings();
    const bookings = await readBookings();
    const filtered = filterBookings(bookings, {
      status: req.query.status,
      search: req.query.search,
      sort: req.query.sort || "created_desc",
    });
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load bookings." });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    await expireStaleBookings();
    const booking = await findBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load booking." });
  }
});

router.get("/bookings/:id/deposit-proof", async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking?.depositProof) {
      return res.status(404).json({ error: "No deposit proof on file." });
    }

    const filename = path.basename(booking.depositProof);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Deposit proof file not found." });
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load deposit proof." });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const { status, adminNotes, date, time } = req.body;
    const booking = await findBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const updates = {};
    let notifyEvent = null;
    let notifyExtra = {};

    if (status !== undefined) {
      const allowed = ["approved", "rejected", "cancelled"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: "Status must be approved, rejected, or cancelled." });
      }
      if (status === "approved" && booking.status !== "deposit_submitted") {
        return res.status(400).json({ error: "Only bookings with submitted deposits can be approved." });
      }
      updates.status = status;
      updates.reviewedAt = new Date().toISOString();
      notifyEvent = status;
    }

    if (date !== undefined || time !== undefined) {
      const newDate = date ?? booking.date;
      const newTime = time ?? booking.time;

      if (!newDate || !newTime) {
        return res.status(400).json({ error: "Both date and time are required to reschedule." });
      }
      if (!TIME_SLOTS.includes(newTime)) {
        return res.status(400).json({ error: "Invalid time slot." });
      }

      const adminAvailable = await isSlotAdminAvailable(newDate, newTime);
      if (!adminAvailable) {
        return res.status(400).json({ error: "That time slot is not available on the admin schedule." });
      }

      await expireStaleBookings();
      const bookings = await readBookings();
      if (isSlotConflict(bookings, newDate, newTime, booking.id)) {
        return res.status(409).json({ error: "That time slot is already booked." });
      }

      updates.date = newDate;
      updates.time = newTime;
      updates.rescheduledAt = new Date().toISOString();
      notifyEvent = "rescheduled";
      notifyExtra = { newDate, newTime };
    }

    if (adminNotes !== undefined) {
      updates.adminNotes = String(adminNotes).trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid updates provided." });
    }

    const updated = await updateBooking(booking.id, updates);

    if (notifyEvent) {
      await notifyBookingUpdate(updated, notifyEvent, notifyExtra);
      await notifyClientBooking(notifyEvent, updated, notifyExtra);
      if (notifyEvent === "approved") {
        await notifyAdminBooking("approved", updated);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update booking." });
  }
});

// Availability management
router.get("/availability", async (_req, res) => {
  try {
    const [schedule, blockedDates] = await Promise.all([
      getWeeklySchedule(),
      getBlockedDates(),
    ]);
    res.json({ schedule, blockedDates, timeSlots: TIME_SLOTS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load availability." });
  }
});

router.put("/availability/schedule", async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Updates array is required." });
    }
    const schedule = await updateWeeklySchedule(updates);
    res.json({ schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update schedule." });
  }
});

router.post("/availability/blocked-dates", async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required." });
    }
    const blocked = await addBlockedDate(date, reason || "");
    res.status(201).json(blocked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not block date." });
  }
});

router.delete("/availability/blocked-dates/:id", async (req, res) => {
  try {
    await removeBlockedDate(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove blocked date." });
  }
});

// Promo codes
router.get("/promos", async (_req, res) => {
  try {
    const promos = await listPromoCodes();
    res.json(promos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load promo codes." });
  }
});

router.post("/promos", async (req, res) => {
  try {
    const { code, description, discountType, discountValue, maxUses, minOrderAmount, expiresAt } = req.body;
    if (!code?.trim() || !discountType || discountValue === undefined) {
      return res.status(400).json({ error: "Code, discount type, and value are required." });
    }
    if (!["percent", "fixed"].includes(discountType)) {
      return res.status(400).json({ error: "Discount type must be percent or fixed." });
    }
    const promo = await createPromoCode({
      code,
      description,
      discountType,
      discountValue,
      maxUses,
      minOrderAmount,
      expiresAt,
      isActive: true,
    });
    res.status(201).json(promo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not create promo code." });
  }
});

router.patch("/promos/:id", async (req, res) => {
  try {
    const promo = await updatePromoCode(req.params.id, req.body);
    res.json(promo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not update promo code." });
  }
});

// User management
router.get("/users", async (_req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load users." });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await deleteUserAccount(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not delete user." });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: "User email is required." });
    }
    await adminSendPasswordReset(email.trim());
    res.json({ ok: true, message: "Password reset email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not send reset email." });
  }
});

export default router;

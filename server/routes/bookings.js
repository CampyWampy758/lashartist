import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { TIME_SLOTS } from "../data/constants.js";
import { services } from "../data/services.js";
import { banks } from "../data/banks.js";
import {
  createBooking,
  findBooking,
  findBookingsByUser,
  readBookings,
  updateBooking,
} from "../utils/storage.js";
import { expireStaleBookings, isSlotConflict } from "../utils/bookings.js";
import { getAvailableSlotsForDate, isSlotAdminAvailable } from "../utils/availability.js";
import { optionalUserAuth } from "../middleware/userAuth.js";
import {
  calculateDiscount,
  findPromoByCode,
  incrementPromoUse,
  validatePromo,
} from "../utils/promos.js";
import { notifyAdminBooking } from "../utils/adminMail.js";
import { notifyClientBooking } from "../utils/clientMail.js";
import { notifyBookingUpdate } from "../utils/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

const router = Router();

function getDepositPercent() {
  return Number(process.env.DEPOSIT_PERCENT) || 50;
}

function sanitizeBooking(booking) {
  const { adminNotes, ...publicFields } = booking;
  return publicFields;
}

router.get("/availability", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Date is required." });
    }

    await expireStaleBookings();
    const bookings = await readBookings();
    const booked = bookings
      .filter((b) => b.date === date && ["pending_deposit", "deposit_submitted", "approved"].includes(b.status))
      .map((b) => b.time);

    const slots = await getAvailableSlotsForDate(date, booked);

    res.json({ date, slots, timeSlots: TIME_SLOTS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load availability." });
  }
});

router.post("/", optionalUserAuth, async (req, res) => {
  try {
    const {
      serviceId, date, time, clientName, phone, email, notes,
      preferredBankId, promoCode,
    } = req.body;

    if (!serviceId || !date || !time || !clientName?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: "Service, date, time, name, and phone are required." });
    }

    if (!TIME_SLOTS.includes(time)) {
      return res.status(400).json({ error: "Invalid time slot selected." });
    }

    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return res.status(400).json({ error: "Invalid service selected." });
    }

    if (preferredBankId && !banks.find((b) => b.id === preferredBankId)) {
      return res.status(400).json({ error: "Invalid bank selected." });
    }

    const adminAvailable = await isSlotAdminAvailable(date, time);
    if (!adminAvailable) {
      return res.status(400).json({ error: "That time slot is not available. Please choose another." });
    }

    await expireStaleBookings();
    const bookings = await readBookings();
    if (isSlotConflict(bookings, date, time)) {
      return res.status(409).json({ error: "That time slot is no longer available. Please choose another." });
    }

    let discountAmount = 0;
    let promoCodeId = null;
    let appliedPromoCode = null;
    let finalPrice = service.price;

    if (promoCode?.trim()) {
      const promo = await findPromoByCode(promoCode);
      const check = validatePromo(promo, service.price);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      discountAmount = calculateDiscount(promo, service.price);
      finalPrice = service.price - discountAmount;
      promoCodeId = promo.id;
      appliedPromoCode = promo.code;
    }

    const depositPercent = getDepositPercent();
    const depositAmount = Math.round(finalPrice * (depositPercent / 100));
    const reference = `LIYELLE-${uuidv4().slice(0, 8).toUpperCase()}`;
    const holdHours = Number(process.env.DEPOSIT_HOLD_HOURS) || 24;
    const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString();

    const booking = {
      id: uuidv4(),
      reference,
      userId: req.user?.id || null,
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: finalPrice,
      depositPercent,
      depositAmount,
      balanceDue: finalPrice - depositAmount,
      promoCodeId,
      promoCode: appliedPromoCode,
      discountAmount,
      date,
      time,
      clientName: clientName.trim(),
      phone: phone.trim(),
      email: email?.trim() || req.user?.email || "",
      notes: notes?.trim() || "",
      preferredBankId: preferredBankId || null,
      status: "pending_deposit",
      depositProof: null,
      adminNotes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt,
    };

    const created = await createBooking(booking);

    if (promoCodeId) {
      await incrementPromoUse(promoCodeId);
    }

    await notifyAdminBooking("created", created);
    await notifyClientBooking("created", created);

    res.status(201).json(sanitizeBooking(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create booking." });
  }
});

router.get("/mine", optionalUserAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Sign in required." });
    }
    await expireStaleBookings();
    const bookings = await findBookingsByUser(req.user.id);
    res.json(bookings.map(sanitizeBooking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load bookings." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    await expireStaleBookings();
    const booking = await findBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }
    res.json(sanitizeBooking(booking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load booking." });
  }
});

router.post("/:id/deposit-proof", upload.single("proof"), async (req, res) => {
  try {
    await expireStaleBookings();
    const booking = await findBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (!["pending_deposit", "deposit_submitted"].includes(booking.status)) {
      return res.status(400).json({ error: "Deposit cannot be submitted for this booking." });
    }

    if (new Date(booking.expiresAt) < new Date() && booking.status === "pending_deposit") {
      await updateBooking(booking.id, { status: "expired" });
      const expired = { ...booking, status: "expired" };
      await notifyBookingUpdate(expired, "expired");
      await notifyAdminBooking("expired", expired);
      await notifyClientBooking("expired", expired);
      return res.status(400).json({ error: "Booking hold has expired. Please book again." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a transfer screenshot." });
    }

    const updated = await updateBooking(booking.id, {
      status: "deposit_submitted",
      depositProof: `/uploads/${req.file.filename}`,
      depositSubmittedAt: new Date().toISOString(),
    });

    await notifyBookingUpdate(updated, "deposit_submitted");
    await notifyAdminBooking("deposit_submitted", updated);
    await notifyClientBooking("deposit_submitted", updated);

    res.json(sanitizeBooking(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Upload failed." });
  }
});

export default router;

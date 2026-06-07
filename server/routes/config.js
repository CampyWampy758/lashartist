import { Router } from "express";
import { services } from "../data/services.js";
import { banks } from "../data/banks.js";

const router = Router();

router.get("/services", (_req, res) => {
  res.json(services);
});

router.get("/banks", (_req, res) => {
  res.json(
    banks.map(({ id, name, shortName, accountName, accountNumber, branch }) => ({
      id,
      name,
      shortName,
      accountName,
      accountNumber: accountNumber || null,
      branch: branch || null,
      configured: Boolean(accountNumber),
    }))
  );
});

router.get("/settings", (_req, res) => {
  res.json({
    depositPercent: Number(process.env.DEPOSIT_PERCENT) || 50,
    depositHoldHours: Number(process.env.DEPOSIT_HOLD_HOURS) || 24,
    currency: "EC$",
    studioName: "The Liyelle Atelier",
    studioType: "Salon Studio",
    whatsapp: process.env.WHATSAPP_NUMBER || "",
    instagram: process.env.INSTAGRAM_HANDLE || "",
    email: process.env.STUDIO_EMAIL || "",
    address: process.env.STUDIO_ADDRESS || "Vieux-Fort, Saint Lucia",
    hours: process.env.STUDIO_HOURS || "Tue–Sat · 9:00 AM – 6:00 PM",
  });
});

export default router;

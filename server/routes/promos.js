import { Router } from "express";
import { calculateDiscount, findPromoByCode, validatePromo } from "../utils/promos.js";
import { services } from "../data/services.js";

const router = Router();

router.post("/validate", async (req, res) => {
  try {
    const { code, serviceId } = req.body;
    if (!code?.trim() || !serviceId) {
      return res.status(400).json({ error: "Promo code and service are required." });
    }

    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return res.status(400).json({ error: "Invalid service." });
    }

    const promo = await findPromoByCode(code);
    const check = validatePromo(promo, service.price);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const discount = calculateDiscount(promo, service.price);
    res.json({
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: discount,
      finalPrice: service.price - discount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not validate promo code." });
  }
});

export default router;

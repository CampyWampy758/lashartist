import { Router } from "express";
import { userAuth } from "../middleware/userAuth.js";
import { updateUserProfile, deleteUserAccount, sendPasswordReset } from "../utils/users.js";
import { supabaseEnabled } from "../utils/supabase.js";

const router = Router();

router.use(userAuth);

router.get("/profile", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.user_metadata?.full_name || "",
        phone: req.user.user_metadata?.phone || "",
      });
    }
    const { getUserProfile } = await import("../utils/users.js");
    const profile = await getUserProfile(req.user.id);
    res.json({
      id: req.user.id,
      email: req.user.email,
      fullName: profile?.fullName || req.user.user_metadata?.full_name || "",
      phone: profile?.phone || req.user.user_metadata?.phone || "",
      role: profile?.role || "client",
      createdAt: profile?.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load profile." });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    if (!supabaseEnabled) {
      return res.status(503).json({ error: "Profile updates require Supabase." });
    }
    const profile = await updateUserProfile(req.user.id, { fullName, phone });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    if (!req.user.email) {
      return res.status(400).json({ error: "No email on account." });
    }
    await sendPasswordReset(req.user.email);
    res.json({ ok: true, message: "Password reset email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not send reset email." });
  }
});

router.delete("/", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: "Account deletion requires Supabase." });
    }
    await deleteUserAccount(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not delete account." });
  }
});

export default router;

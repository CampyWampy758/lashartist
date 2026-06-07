import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import configRoutes from "./routes/config.js";
import bookingRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";
import notificationRoutes from "./routes/notifications.js";
import promoRoutes from "./routes/promos.js";
import accountRoutes from "./routes/account.js";
import { adminMailEnabled } from "./utils/adminMail.js";
import { clientMailEnabled } from "./utils/clientMail.js";
import { supabaseEnabled, supabase } from "./utils/supabase.js";
import { DEPOSIT_BUCKET } from "./utils/depositStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PORT = process.env.ADMIN_PORT || 5001;

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  process.env.ADMIN_URL || "http://localhost:5174",
].filter(Boolean);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", async (_req, res) => {
  const health = {
    ok: true,
    name: "The Liyelle Atelier API",
    supabase: supabaseEnabled,
    storage: supabaseEnabled ? DEPOSIT_BUCKET : "local-disk",
  };

  if (supabaseEnabled) {
    try {
      const { error } = await supabase.from("bookings").select("id").limit(1);
      health.database = error ? "error" : "connected";
      if (error) health.databaseError = error.message;
    } catch (err) {
      health.database = "error";
      health.databaseError = err.message;
    }
  }

  res.json(health);
});

app.use("/api", configRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/account", accountRoutes);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.message === "Not allowed by CORS" ? 403 : 500).json({
    error: err.message || "Server error",
  });
});

app.listen(PORT, () => {
  console.log(`Public API + site: http://localhost:${PORT}`);
  console.log(
    supabaseEnabled
      ? "Database: Supabase (Postgres + Storage for deposit proofs)"
      : "Database: local JSON files (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for production)"
  );
  console.log(
    adminMailEnabled
      ? "Admin email alerts: enabled"
      : "Admin email alerts: disabled (set GMAIL_USER + GMAIL_APP_PASSWORD in .env)"
  );
  console.log(
    clientMailEnabled
      ? "Client confirmation emails: enabled"
      : "Client confirmation emails: disabled (set GMAIL_USER + GMAIL_APP_PASSWORD in .env)"
  );
});

if (process.env.NODE_ENV === "production") {
  const adminDist = path.join(__dirname, "../admin/dist");
  if (fs.existsSync(adminDist)) {
    const adminApp = express();
    adminApp.use(express.static(adminDist));
    adminApp.get("*", (_req, res) => {
      res.sendFile(path.join(adminDist, "index.html"));
    });
    adminApp.listen(ADMIN_PORT, () => {
      console.log(`Admin panel: http://localhost:${ADMIN_PORT}`);
    });
  }
}

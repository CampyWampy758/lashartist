/**
 * One-time migration: local JSON + disk uploads → Supabase Postgres + Storage.
 *
 * Usage (from repo root):
 *   npm run migrate:supabase --prefix server
 *
 * Safe to re-run — skips bookings that already exist (by id) and only
 * uploads deposit proofs that are still on local disk.
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, supabaseEnabled } from "../utils/supabase.js";
import {
  DEPOSIT_BUCKET,
  ensureDepositBucket,
  isStoragePath,
  migrateLocalProofToStorage,
} from "../utils/depositStorage.js";
import { TIME_SLOTS } from "../data/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const UPLOADS_DIR = path.join(__dirname, "../uploads");

function toBookingRow(booking) {
  return {
    id: booking.id,
    reference: booking.reference,
    user_id: booking.userId || null,
    service_id: booking.serviceId,
    service_name: booking.serviceName,
    service_price: booking.servicePrice,
    deposit_percent: booking.depositPercent ?? 50,
    deposit_amount: booking.depositAmount,
    balance_due: booking.balanceDue,
    promo_code_id: booking.promoCodeId || null,
    promo_code: booking.promoCode || null,
    discount_amount: booking.discountAmount || 0,
    date: booking.date,
    time: booking.time,
    client_name: booking.clientName,
    phone: booking.phone,
    email: booking.email || "",
    notes: booking.notes || "",
    preferred_bank_id: booking.preferredBankId || null,
    status: booking.status,
    deposit_proof: booking.depositProof || null,
    admin_notes: booking.adminNotes || "",
    created_at: booking.createdAt,
    updated_at: booking.updatedAt,
    expires_at: booking.expiresAt || null,
    deposit_submitted_at: booking.depositSubmittedAt || null,
    reviewed_at: booking.reviewedAt || null,
    rescheduled_at: booking.rescheduledAt || null,
  };
}

async function migrateBookings() {
  const filePath = path.join(DATA_DIR, "bookings.json");
  let bookings;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    bookings = JSON.parse(raw);
  } catch {
    console.log("No bookings.json found — skipping booking import.");
    return { imported: 0, skipped: 0, proofsMigrated: 0 };
  }

  if (!Array.isArray(bookings) || bookings.length === 0) {
    console.log("bookings.json is empty — nothing to import.");
    return { imported: 0, skipped: 0, proofsMigrated: 0 };
  }

  await ensureDepositBucket();

  let imported = 0;
  let skipped = 0;
  let proofsMigrated = 0;

  for (const booking of bookings) {
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, deposit_proof")
      .eq("id", booking.id)
      .maybeSingle();

    let depositProof = booking.depositProof || null;

    if (depositProof && !isStoragePath(depositProof)) {
      const filename = path.basename(depositProof);
      const localPath = path.join(UPLOADS_DIR, filename);
      try {
        await fs.access(localPath);
        depositProof = await migrateLocalProofToStorage(booking.id, localPath);
        proofsMigrated += 1;
        console.log(`  ↑ uploaded deposit proof for ${booking.reference}`);
      } catch {
        console.warn(`  ⚠ local proof missing for ${booking.reference}: ${filename}`);
      }
    }

    if (existing) {
      if (depositProof && depositProof !== existing.deposit_proof && isStoragePath(depositProof)) {
        await supabase
          .from("bookings")
          .update({ deposit_proof: depositProof })
          .eq("id", booking.id);
        console.log(`  ↻ updated deposit proof path for ${booking.reference}`);
      }
      skipped += 1;
      continue;
    }

    const row = toBookingRow({ ...booking, depositProof });
    const { error } = await supabase.from("bookings").insert(row);
    if (error) {
      console.error(`  ✗ failed to import ${booking.reference}:`, error.message);
      continue;
    }

    imported += 1;
    console.log(`  ✓ imported ${booking.reference}`);
  }

  return { imported, skipped, proofsMigrated };
}

async function migrateAvailability() {
  const filePath = path.join(DATA_DIR, "availability.json");
  let file;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    file = JSON.parse(raw);
  } catch {
    console.log("No availability.json found — skipping availability sync.");
    return { slotsUpdated: 0, blockedDates: 0 };
  }

  let slotsUpdated = 0;

  if (file.schedule) {
    const rows = [];
    for (let day = 0; day <= 6; day += 1) {
      const daySlots = file.schedule[day] || file.schedule[String(day)] || [];
      for (const slot of daySlots) {
        if (!TIME_SLOTS.includes(slot.time)) continue;
        rows.push({
          day_of_week: day,
          time_slot: slot.time,
          is_available: Boolean(slot.available),
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("availability_slots")
        .upsert(rows, { onConflict: "day_of_week,time_slot" });

      if (error) throw error;
      slotsUpdated = rows.length;
      console.log(`  ✓ synced ${slotsUpdated} availability slots`);
    }
  }

  let blockedDates = 0;
  if (Array.isArray(file.blockedDates)) {
    for (const blocked of file.blockedDates) {
      const { error } = await supabase
        .from("blocked_dates")
        .upsert(
          { id: blocked.id?.startsWith("local-") ? undefined : blocked.id, date: blocked.date, reason: blocked.reason || "" },
          { onConflict: "date" }
        );

      if (error) {
        console.warn(`  ⚠ blocked date ${blocked.date}:`, error.message);
      } else {
        blockedDates += 1;
      }
    }
    if (blockedDates > 0) {
      console.log(`  ✓ synced ${blockedDates} blocked dates`);
    }
  }

  return { slotsUpdated, blockedDates };
}

async function verifyConnection() {
  const { error } = await supabase.from("bookings").select("id").limit(1);
  if (error) throw error;

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw bucketError;

  const hasBucket = buckets?.some((b) => b.name === DEPOSIT_BUCKET);
  console.log(`Connected to Supabase (storage bucket "${DEPOSIT_BUCKET}": ${hasBucket ? "ready" : "will be created"})`);
}

async function main() {
  if (!supabaseEnabled) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first.");
    process.exit(1);
  }

  console.log("\n=== Liyelle Atelier → Supabase migration ===\n");

  await verifyConnection();

  console.log("\n1. Bookings");
  const bookingStats = await migrateBookings();
  console.log(`   Done: ${bookingStats.imported} imported, ${bookingStats.skipped} already existed, ${bookingStats.proofsMigrated} proofs uploaded`);

  console.log("\n2. Availability");
  const availStats = await migrateAvailability();
  console.log(`   Done: ${availStats.slotsUpdated} slots, ${availStats.blockedDates} blocked dates`);

  console.log("\n=== Migration complete ===\n");
  console.log("Next steps:");
  console.log("  • Run supabase/schema.sql in your Supabase SQL Editor if you haven't yet");
  console.log("  • Restart the server — it will use Supabase as the primary data store");
  console.log("  • New deposit proofs upload directly to Supabase Storage\n");
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});

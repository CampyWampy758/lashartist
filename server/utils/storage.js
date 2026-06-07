import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, supabaseEnabled } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

function mapBookingRow(row) {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id || null,
    serviceId: row.service_id,
    serviceName: row.service_name,
    servicePrice: row.service_price,
    depositPercent: row.deposit_percent,
    depositAmount: row.deposit_amount,
    balanceDue: row.balance_due,
    promoCodeId: row.promo_code_id || null,
    promoCode: row.promo_code || null,
    discountAmount: row.discount_amount || 0,
    date: row.date,
    time: row.time,
    clientName: row.client_name,
    phone: row.phone,
    email: row.email || "",
    notes: row.notes || "",
    preferredBankId: row.preferred_bank_id || null,
    status: row.status,
    depositProof: row.deposit_proof || null,
    adminNotes: row.admin_notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    depositSubmittedAt: row.deposit_submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    rescheduledAt: row.rescheduled_at || null,
  };
}

function toBookingRow(booking) {
  return {
    id: booking.id,
    reference: booking.reference,
    user_id: booking.userId || null,
    service_id: booking.serviceId,
    service_name: booking.serviceName,
    service_price: booking.servicePrice,
    deposit_percent: booking.depositPercent,
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
    expires_at: booking.expiresAt,
    deposit_submitted_at: booking.depositSubmittedAt || null,
    reviewed_at: booking.reviewedAt || null,
    rescheduled_at: booking.rescheduledAt || null,
  };
}

async function ensureDataFile() {
  try {
    await fs.access(BOOKINGS_FILE);
  } catch {
    await fs.writeFile(BOOKINGS_FILE, "[]", "utf-8");
  }
}

async function readBookingsJson() {
  await ensureDataFile();
  const raw = await fs.readFile(BOOKINGS_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeBookingsJson(bookings) {
  await ensureDataFile();
  await fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), "utf-8");
}

export async function readBookings() {
  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data.map(mapBookingRow);
  }
  return readBookingsJson();
}

export async function findBooking(id) {
  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapBookingRow(data) : null;
  }

  const bookings = await readBookingsJson();
  return bookings.find((b) => b.id === id) ?? null;
}

export async function findBookingsByUser(userId) {
  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data.map(mapBookingRow);
  }

  const bookings = await readBookingsJson();
  return bookings.filter((b) => b.userId === userId);
}

export async function updateBooking(id, updates) {
  const merged = { ...updates, updatedAt: new Date().toISOString() };

  if (supabaseEnabled) {
    const row = {};
    if (merged.status !== undefined) row.status = merged.status;
    if (merged.depositProof !== undefined) row.deposit_proof = merged.depositProof;
    if (merged.adminNotes !== undefined) row.admin_notes = merged.adminNotes;
    if (merged.date !== undefined) row.date = merged.date;
    if (merged.time !== undefined) row.time = merged.time;
    if (merged.reviewedAt !== undefined) row.reviewed_at = merged.reviewedAt;
    if (merged.rescheduledAt !== undefined) row.rescheduled_at = merged.rescheduledAt;
    if (merged.depositSubmittedAt !== undefined) row.deposit_submitted_at = merged.depositSubmittedAt;
    if (merged.expiresAt !== undefined) row.expires_at = merged.expiresAt;
    row.updated_at = merged.updatedAt;

    const { data, error } = await supabase
      .from("bookings")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return mapBookingRow(data);
  }

  const bookings = await readBookingsJson();
  const index = bookings.findIndex((b) => b.id === id);
  if (index === -1) return null;
  bookings[index] = { ...bookings[index], ...merged };
  await writeBookingsJson(bookings);
  return bookings[index];
}

export async function createBooking(booking) {
  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("bookings")
      .insert(toBookingRow(booking))
      .select()
      .single();

    if (error) throw error;
    return mapBookingRow(data);
  }

  const bookings = await readBookingsJson();
  bookings.unshift(booking);
  await writeBookingsJson(bookings);
  return booking;
}

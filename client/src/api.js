import { supabase, supabaseConfigured } from "./lib/supabase";

const DEPOSIT_BUCKET = "deposit-proofs";

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function mapBooking(row) {
  if (!row) return null;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    depositSubmittedAt: row.deposit_submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    rescheduledAt: row.rescheduled_at || null,
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    bookingId: row.booking_id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

function rpcError(error) {
  throw new Error(error.message || "Request failed.");
}

export async function fetchServices() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) rpcError(error);
  return data.map(({ id, name, tagline, description, duration, price, vibe }) => ({
    id,
    name,
    tagline,
    description,
    duration,
    price,
    vibe,
  }));
}

export async function fetchBanks() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bank_accounts")
    .select("*")
    .order("sort_order");

  if (error) rpcError(error);
  return data.map(({ id, name, short_name, account_name, account_number, branch }) => ({
    id,
    name,
    shortName: short_name,
    accountName: account_name,
    accountNumber: account_number || null,
    branch: branch || null,
    configured: Boolean(account_number),
  }));
}

export async function fetchSettings() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("studio_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) rpcError(error);
  return {
    depositPercent: data.deposit_percent,
    depositHoldHours: data.deposit_hold_hours,
    currency: data.currency,
    studioName: data.studio_name,
    studioType: data.studio_type,
    whatsapp: data.whatsapp || "",
    instagram: data.instagram || "",
    email: data.email || "",
    address: data.address || "",
    hours: data.hours || "",
  };
}

export async function fetchAvailability(date) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("get_availability_for_date", { p_date: date });
  if (error) rpcError(error);
  return {
    date: data.date,
    slots: data.slots,
    timeSlots: data.timeSlots,
  };
}

export async function validatePromoCode(code, serviceId) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("validate_promo_code", {
    p_code: code,
    p_service_id: serviceId,
  });
  if (error) rpcError(error);
  if (!data.valid) throw new Error(data.error || "Invalid promo code.");
  return data;
}

export async function createBooking(payload) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("create_booking", {
    p_service_id: payload.serviceId,
    p_date: payload.date,
    p_time: payload.time,
    p_client_name: payload.clientName,
    p_phone: payload.phone,
    p_email: payload.email || "",
    p_notes: payload.notes || "",
    p_preferred_bank_id: payload.preferredBankId || null,
    p_promo_code: payload.promoCode || null,
  });
  if (error) rpcError(error);
  return mapBooking(data);
}

export async function fetchBooking(id) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) rpcError(error);
  if (!data) throw new Error("Booking not found.");
  return mapBooking(data);
}

export async function fetchMyBookings() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) rpcError(error);
  return data.map(mapBooking);
}

export async function uploadDepositProof(id, file) {
  const sb = requireSupabase();
  const ext = file.name.match(/\.[^.]+$/)?.[0] || ".jpg";
  const storagePath = `${id}/${Date.now()}${ext}`;

  const { error: uploadError } = await sb.storage
    .from(DEPOSIT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) rpcError(uploadError);

  const { data, error } = await sb.rpc("submit_deposit_proof", {
    p_booking_id: id,
    p_storage_path: storagePath,
  });
  if (error) rpcError(error);
  return mapBooking(data);
}

export async function fetchNotifications() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) rpcError(error);
  return data.map(mapNotification);
}

export async function markNotificationRead(id) {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { data, error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) rpcError(error);
  return mapNotification(data);
}

export async function markAllNotificationsRead() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) rpcError(error);
}

export async function updateProfile(data) {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { data: profile, error } = await sb
    .from("profiles")
    .update({
      full_name: data.fullName?.trim(),
      phone: data.phone?.trim(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) rpcError(error);
  return profile;
}

export async function requestPasswordReset() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) throw new Error("No email on account.");

  const { error } = await sb.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) rpcError(error);
}

export async function deleteAccount() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const { error: profileError } = await sb.from("profiles").delete().eq("id", user.id);
  if (profileError) rpcError(profileError);

  await sb.auth.signOut();
}

export function formatEC(amount) {
  return `EC$${amount.toFixed(0)}`;
}

export const STATUS_LABELS = {
  pending_deposit: "Awaiting deposit",
  deposit_submitted: "Under review",
  approved: "Confirmed",
  rejected: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const TIME_SLOTS = [
  "9:00 AM",
  "10:30 AM",
  "12:00 PM",
  "1:30 PM",
  "3:00 PM",
  "4:30 PM",
];

import { supabase, supabaseConfigured } from "./lib/supabase";

const DEPOSIT_BUCKET = "deposit-proofs";

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

async function requireAdmin() {
  const sb = requireSupabase();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) throw new Error("Sign in required.");

  const { data: profile, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin") {
    throw new Error("Admin access required.");
  }

  return sb;
}

function mapBooking(row) {
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

function mapPromo(row) {
  return {
    id: row.id,
    code: row.code,
    description: row.description || "",
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxUses: row.max_uses,
    useCount: row.use_count,
    minOrderAmount: row.min_order_amount,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rpcError(error) {
  throw new Error(error.message || "Request failed.");
}

export async function adminSignIn(email, password) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) rpcError(error);

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "admin") {
    await sb.auth.signOut();
    throw new Error("This account does not have admin access.");
  }

  return data.user;
}

export async function adminSignOut() {
  const sb = requireSupabase();
  await sb.auth.signOut();
}

export async function adminGetSession() {
  const sb = requireSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return session;
}

function filterBookings(bookings, { status, search, sort = "created_desc" }) {
  let result = [...bookings];

  if (status && status !== "all") {
    result = result.filter((b) => b.status === status);
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (b) =>
        b.reference?.toLowerCase().includes(q) ||
        b.clientName?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.serviceName?.toLowerCase().includes(q)
    );
  }

  result.sort((a, b) => {
    if (sort === "date_asc") {
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    }
    if (sort === "date_desc") {
      return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return result;
}

function computeStats(bookings) {
  const counts = {
    total: bookings.length,
    pending_deposit: 0,
    deposit_submitted: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  };

  let depositsApproved = 0;
  let depositsPending = 0;

  for (const b of bookings) {
    if (counts[b.status] !== undefined) counts[b.status]++;
    if (b.status === "approved") depositsApproved += b.depositAmount || 0;
    if (b.status === "pending_deposit" || b.status === "deposit_submitted") {
      depositsPending += b.depositAmount || 0;
    }
  }

  return { ...counts, depositsApproved, depositsPending };
}

export async function adminFetchStats() {
  const sb = await requireAdmin();
  await sb.rpc("expire_stale_bookings");

  const { data, error } = await sb.from("bookings").select("*");
  if (error) rpcError(error);
  return computeStats(data.map(mapBooking));
}

export async function adminFetchBookings({ status, search, sort } = {}) {
  const sb = await requireAdmin();
  await sb.rpc("expire_stale_bookings");

  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) rpcError(error);
  return filterBookings(data.map(mapBooking), { status, search, sort });
}

export async function adminUpdateBooking(id, { status, adminNotes, date, time }) {
  const sb = await requireAdmin();
  const { data, error } = await sb.rpc("admin_update_booking", {
    p_booking_id: id,
    p_status: status ?? null,
    p_admin_notes: adminNotes ?? null,
    p_date: date ?? null,
    p_time: time ?? null,
  });
  if (error) rpcError(error);
  return mapBooking(data);
}

export async function adminFetchDepositProofUrl(bookingId) {
  const sb = await requireAdmin();

  const { data: booking, error } = await sb
    .from("bookings")
    .select("deposit_proof")
    .eq("id", bookingId)
    .single();

  if (error || !booking?.deposit_proof) {
    throw new Error("No deposit proof on file.");
  }

  const { data, error: urlError } = await sb.storage
    .from(DEPOSIT_BUCKET)
    .createSignedUrl(booking.deposit_proof, 3600);

  if (urlError) rpcError(urlError);
  return data.signedUrl;
}

export async function adminFetchAvailability() {
  const sb = await requireAdmin();

  const [{ data: slots, error: slotError }, { data: blocked, error: blockedError }] =
    await Promise.all([
      sb.from("availability_slots").select("*").order("day_of_week").order("time_slot"),
      sb.from("blocked_dates").select("*").order("date"),
    ]);

  if (slotError) rpcError(slotError);
  if (blockedError) rpcError(blockedError);

  const schedule = {};
  for (let day = 0; day <= 6; day += 1) {
    schedule[day] = TIME_SLOTS.map((time) => {
      const row = slots.find((s) => s.day_of_week === day && s.time_slot === time);
      return { time, available: row ? Boolean(row.is_available) : day >= 2 && day <= 6 };
    });
  }

  return {
    schedule,
    blockedDates: blocked.map((b) => ({ id: b.id, date: b.date, reason: b.reason || "" })),
    timeSlots: TIME_SLOTS,
  };
}

export async function adminUpdateSchedule(updates) {
  const sb = await requireAdmin();
  const rows = updates.map(({ dayOfWeek, timeSlot, isAvailable }) => ({
    day_of_week: dayOfWeek,
    time_slot: timeSlot,
    is_available: isAvailable,
  }));

  const { error } = await sb
    .from("availability_slots")
    .upsert(rows, { onConflict: "day_of_week,time_slot" });

  if (error) rpcError(error);
  return adminFetchAvailability();
}

export async function adminAddBlockedDate(date, reason) {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("blocked_dates")
    .insert({ date, reason: reason || "" })
    .select()
    .single();

  if (error) rpcError(error);
  return { id: data.id, date: data.date, reason: data.reason || "" };
}

export async function adminRemoveBlockedDate(id) {
  const sb = await requireAdmin();
  const { error } = await sb.from("blocked_dates").delete().eq("id", id);
  if (error) rpcError(error);
}

export async function adminFetchPromos() {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) rpcError(error);
  return data.map(mapPromo);
}

export async function adminCreatePromo(fields) {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("promo_codes")
    .insert({
      code: fields.code.toUpperCase().trim(),
      description: fields.description || "",
      discount_type: fields.discountType,
      discount_value: fields.discountValue,
      max_uses: fields.maxUses ?? null,
      min_order_amount: fields.minOrderAmount ?? 0,
      expires_at: fields.expiresAt || null,
      is_active: fields.isActive !== false,
    })
    .select()
    .single();

  if (error) rpcError(error);
  return mapPromo(data);
}

export async function adminUpdatePromo(id, fields) {
  const sb = await requireAdmin();
  const updates = {};
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.discountType !== undefined) updates.discount_type = fields.discountType;
  if (fields.discountValue !== undefined) updates.discount_value = fields.discountValue;
  if (fields.maxUses !== undefined) updates.max_uses = fields.maxUses;
  if (fields.minOrderAmount !== undefined) updates.min_order_amount = fields.minOrderAmount;
  if (fields.expiresAt !== undefined) updates.expires_at = fields.expiresAt;
  if (fields.isActive !== undefined) updates.is_active = fields.isActive;

  const { data, error } = await sb
    .from("promo_codes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) rpcError(error);
  return mapPromo(data);
}

export async function adminFetchUsers() {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) rpcError(error);
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name || "",
    phone: row.phone || "",
    email: row.email || "",
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function adminDeleteUser(id) {
  const sb = await requireAdmin();
  const { error } = await sb.functions.invoke("admin-delete-user", {
    body: { userId: id },
  });
  if (error) rpcError(error);
}

export async function adminResetUserPassword(email) {
  const sb = await requireAdmin();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: import.meta.env.VITE_CLIENT_URL || window.location.origin,
  });
  if (error) rpcError(error);
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

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

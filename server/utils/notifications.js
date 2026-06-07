import { supabase, supabaseEnabled } from "./supabase.js";

const TYPE_LABELS = {
  booking_confirmed: "Booking confirmed",
  booking_rescheduled: "Appointment rescheduled",
  booking_declined: "Booking declined",
  booking_cancelled: "Booking cancelled",
  deposit_received: "Deposit received",
  booking_expired: "Booking expired",
};

export async function createNotification({ userId, bookingId, type, title, message }) {
  if (!userId || !supabaseEnabled) return null;

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      booking_id: bookingId || null,
      type,
      title: title || TYPE_LABELS[type] || "Update",
      message,
    })
    .select()
    .single();

  if (error) {
    console.error("Notification error:", error);
    return null;
  }
  return mapNotification(data);
}

export function mapNotification(row) {
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

export async function notifyBookingUpdate(booking, event, extra = {}) {
  if (!booking.userId) return;

  const messages = {
    approved: {
      type: "booking_confirmed",
      title: "Appointment confirmed",
      message: `Your ${booking.serviceName} on ${booking.date} at ${booking.time} is confirmed. See you at the studio!`,
    },
    rejected: {
      type: "booking_declined",
      title: "Booking declined",
      message: `Your booking (${booking.reference}) was declined. Contact us on WhatsApp if you have questions.`,
    },
    cancelled: {
      type: "booking_cancelled",
      title: "Booking cancelled",
      message: `Your booking (${booking.reference}) for ${booking.date} has been cancelled.`,
    },
    rescheduled: {
      type: "booking_rescheduled",
      title: "Appointment rescheduled",
      message: `Your appointment has been moved to ${extra.newDate || booking.date} at ${extra.newTime || booking.time}.`,
    },
    deposit_submitted: {
      type: "deposit_received",
      title: "Deposit received",
      message: `We received your deposit for ${booking.reference}. Awaiting admin approval.`,
    },
    expired: {
      type: "booking_expired",
      title: "Booking expired",
      message: `Your hold on ${booking.date} at ${booking.time} expired. Book again to reserve a new slot.`,
    },
  };

  const payload = messages[event];
  if (!payload) return;

  await createNotification({
    userId: booking.userId,
    bookingId: booking.id,
    ...payload,
  });
}

export async function getUserNotifications(userId) {
  if (!supabaseEnabled) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data.map(mapNotification);
}

export async function markNotificationRead(id, userId) {
  if (!supabaseEnabled) return null;

  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return mapNotification(data);
}

export async function markAllNotificationsRead(userId) {
  if (!supabaseEnabled) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
}

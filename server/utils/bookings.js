import { ACTIVE_STATUSES } from "../data/constants.js";
import { readBookings, updateBooking } from "./storage.js";

export async function expireStaleBookings() {
  const bookings = await readBookings();
  const now = new Date();
  let changed = false;

  for (const booking of bookings) {
    if (booking.status === "pending_deposit" && new Date(booking.expiresAt) < now) {
      await updateBooking(booking.id, { status: "expired" });
      changed = true;
    }
  }

  return changed;
}

export function isSlotConflict(bookings, date, time, excludeId = null) {
  return bookings.some(
    (b) =>
      b.id !== excludeId &&
      b.date === date &&
      b.time === time &&
      ACTIVE_STATUSES.includes(b.status)
  );
}

export function filterBookings(bookings, { status, search, sort = "created_desc" }) {
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

export function computeStats(bookings) {
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

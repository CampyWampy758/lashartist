const API_BASE = import.meta.env.VITE_API_URL || "";
const API = `${API_BASE}/api`;

async function parseResponse(res, fallbackError) {
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Server returned an invalid response."
          : `Server error (${res.status}). Make sure the API is running.`
      );
    }
  } else if (!res.ok) {
    throw new Error(
      res.status === 502 || res.status === 504
        ? "Cannot reach the booking server. Please try again shortly."
        : fallbackError
    );
  }
  if (!res.ok) throw new Error(json.error || fallbackError);
  return json;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchServices() {
  const res = await fetch(`${API}/services`);
  return parseResponse(res, "Failed to load services");
}

export async function fetchBanks() {
  const res = await fetch(`${API}/banks`);
  return parseResponse(res, "Failed to load banks");
}

export async function fetchSettings() {
  const res = await fetch(`${API}/settings`);
  return parseResponse(res, "Failed to load settings");
}

export async function fetchAvailability(date) {
  const res = await fetch(`${API}/bookings/availability?date=${encodeURIComponent(date)}`);
  return parseResponse(res, "Failed to load availability");
}

export async function validatePromoCode(code, serviceId) {
  const res = await fetch(`${API}/promos/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, serviceId }),
  });
  return parseResponse(res, "Invalid promo code");
}

export async function createBooking(data, token) {
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(data),
  });
  return parseResponse(res, "Booking failed");
}

export async function fetchBooking(id) {
  const res = await fetch(`${API}/bookings/${id}`);
  return parseResponse(res, "Booking not found");
}

export async function fetchMyBookings(token) {
  const res = await fetch(`${API}/bookings/mine`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load bookings");
}

export async function uploadDepositProof(id, file) {
  const form = new FormData();
  form.append("proof", file);
  const res = await fetch(`${API}/bookings/${id}/deposit-proof`, {
    method: "POST",
    body: form,
  });
  return parseResponse(res, "Upload failed");
}

export async function fetchNotifications(token) {
  const res = await fetch(`${API}/notifications`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load notifications");
}

export async function markNotificationRead(token, id) {
  const res = await fetch(`${API}/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not update notification");
}

export async function markAllNotificationsRead(token) {
  const res = await fetch(`${API}/notifications/read-all`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not update notifications");
}

export async function updateProfile(token, data) {
  const res = await fetch(`${API}/account/profile`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return parseResponse(res, "Could not update profile");
}

export async function requestPasswordReset(token) {
  const res = await fetch(`${API}/account/reset-password`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not send reset email");
}

export async function deleteAccount(token) {
  const res = await fetch(`${API}/account`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not delete account");
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

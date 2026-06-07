const API_BASE = import.meta.env.VITE_API_URL || "";

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
        ? "Cannot reach the booking server."
        : fallbackError
    );
  }
  if (!res.ok) throw new Error(json.error || fallbackError);
  return json;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function adminFetchStats(token) {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load stats");
}

export async function adminFetchBookings(token, { status, search, sort } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search?.trim()) params.set("search", search.trim());
  if (sort) params.set("sort", sort);

  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/admin/bookings${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Unauthorized");
}

export async function adminUpdateBooking(token, id, data) {
  const res = await fetch(`${API_BASE}/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return parseResponse(res, "Update failed");
}

export async function adminFetchDepositProof(token, bookingId) {
  const res = await fetch(`${API_BASE}/api/admin/bookings/${bookingId}/deposit-proof`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* ignore */ }
    throw new Error(json.error || "Could not load deposit proof.");
  }
  return res.blob();
}

export async function adminFetchAvailability(token) {
  const res = await fetch(`${API_BASE}/api/admin/availability`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load availability");
}

export async function adminUpdateSchedule(token, updates) {
  const res = await fetch(`${API_BASE}/api/admin/availability/schedule`, {
    method: "PUT",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ updates }),
  });
  return parseResponse(res, "Could not update schedule");
}

export async function adminAddBlockedDate(token, date, reason) {
  const res = await fetch(`${API_BASE}/api/admin/availability/blocked-dates`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, reason }),
  });
  return parseResponse(res, "Could not block date");
}

export async function adminRemoveBlockedDate(token, id) {
  const res = await fetch(`${API_BASE}/api/admin/availability/blocked-dates/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not remove blocked date");
}

export async function adminFetchPromos(token) {
  const res = await fetch(`${API_BASE}/api/admin/promos`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load promos");
}

export async function adminCreatePromo(token, data) {
  const res = await fetch(`${API_BASE}/api/admin/promos`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return parseResponse(res, "Could not create promo");
}

export async function adminUpdatePromo(token, id, data) {
  const res = await fetch(`${API_BASE}/api/admin/promos/${id}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return parseResponse(res, "Could not update promo");
}

export async function adminFetchUsers(token) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not load users");
}

export async function adminDeleteUser(token, id) {
  const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseResponse(res, "Could not delete user");
}

export async function adminResetUserPassword(token, id, email) {
  const res = await fetch(`${API_BASE}/api/admin/users/${id}/reset-password`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  return parseResponse(res, "Could not send reset email");
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

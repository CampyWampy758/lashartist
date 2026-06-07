import { supabase, supabaseEnabled } from "./supabase.js";

function mapProfile(row) {
  return {
    id: row.id,
    fullName: row.full_name || "",
    phone: row.phone || "",
    email: row.email || "",
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers() {
  if (!supabaseEnabled) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapProfile);
}

export async function getUserProfile(userId) {
  if (!supabaseEnabled) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateUserProfile(userId, fields) {
  if (!supabaseEnabled) throw new Error("Supabase is required.");

  const updates = {};
  if (fields.fullName !== undefined) updates.full_name = fields.fullName;
  if (fields.phone !== undefined) updates.phone = fields.phone;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function deleteUserAccount(userId) {
  if (!supabaseEnabled) throw new Error("Supabase is required.");

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  if (!supabaseEnabled) throw new Error("Supabase is required.");

  const redirectTo = process.env.CLIENT_URL
    ? `${process.env.CLIENT_URL}/reset-password`
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function adminSendPasswordReset(email) {
  return sendPasswordReset(email);
}

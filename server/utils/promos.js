import { supabase, supabaseEnabled } from "./supabase.js";

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

export async function listPromoCodes() {
  if (!supabaseEnabled) return [];

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapPromo);
}

export async function createPromoCode(fields) {
  if (!supabaseEnabled) throw new Error("Supabase is required for promo codes.");

  const { data, error } = await supabase
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

  if (error) throw error;
  return mapPromo(data);
}

export async function updatePromoCode(id, fields) {
  if (!supabaseEnabled) throw new Error("Supabase is required for promo codes.");

  const updates = {};
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.discountType !== undefined) updates.discount_type = fields.discountType;
  if (fields.discountValue !== undefined) updates.discount_value = fields.discountValue;
  if (fields.maxUses !== undefined) updates.max_uses = fields.maxUses;
  if (fields.minOrderAmount !== undefined) updates.min_order_amount = fields.minOrderAmount;
  if (fields.expiresAt !== undefined) updates.expires_at = fields.expiresAt;
  if (fields.isActive !== undefined) updates.is_active = fields.isActive;

  const { data, error } = await supabase
    .from("promo_codes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapPromo(data);
}

export async function findPromoByCode(code) {
  if (!supabaseEnabled || !code?.trim()) return null;

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data ? mapPromo(data) : null;
}

export function validatePromo(promo, orderAmount) {
  if (!promo) return { valid: false, error: "Invalid promo code." };
  if (!promo.isActive) return { valid: false, error: "This promo code is inactive." };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { valid: false, error: "This promo code has expired." };
  }
  if (promo.maxUses !== null && promo.useCount >= promo.maxUses) {
    return { valid: false, error: "This promo code has reached its usage limit." };
  }
  if (orderAmount < promo.minOrderAmount) {
    return {
      valid: false,
      error: `Minimum order of EC$${promo.minOrderAmount} required for this code.`,
    };
  }
  return { valid: true };
}

export function calculateDiscount(promo, orderAmount) {
  if (promo.discountType === "percent") {
    return Math.min(orderAmount, Math.round(orderAmount * (promo.discountValue / 100)));
  }
  return Math.min(orderAmount, Math.round(promo.discountValue));
}

export async function incrementPromoUse(promoId) {
  if (!supabaseEnabled) return;

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("use_count")
    .eq("id", promoId)
    .single();

  if (promo) {
    await supabase
      .from("promo_codes")
      .update({ use_count: promo.use_count + 1 })
      .eq("id", promoId);
  }
}

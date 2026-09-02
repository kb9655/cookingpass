import { requireSupabase } from "../lib/supabase";
import type { Ingredient, RecipeIngredient, UserIngredient } from "../types/ingredient";

export async function listCatalogIngredients(): Promise<Ingredient[]> {
  const { data, error } = await requireSupabase()
    .from("ingredients")
    .select("id, name, default_unit, category")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Ingredient[];
}

export async function listUserIngredients(userId: string): Promise<UserIngredient[]> {
  const { data, error } = await requireSupabase()
    .from("user_ingredients")
    .select(
      "id, ingredient_id, amount, unit, expires_at, created_at, ingredients(name, category, default_unit)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const ingredient = unwrap(row.ingredients);
    return {
      id: row.id as string,
      ingredient_id: row.ingredient_id as string,
      amount: Number(row.amount),
      unit: row.unit as string,
      expires_at: (row.expires_at as string | null) ?? null,
      created_at: row.created_at as string,
      name: ingredient?.name ?? "재료",
      category: ingredient?.category ?? "",
      default_unit: ingredient?.default_unit ?? row.unit,
    };
  });
}

export async function upsertUserIngredient(input: {
  userId: string;
  ingredientId: string;
  amount: number;
  unit: string;
  expiresAt?: string | null;
}): Promise<void> {
  const { error } = await requireSupabase().from("user_ingredients").upsert(
    {
      user_id: input.userId,
      ingredient_id: input.ingredientId,
      amount: input.amount,
      unit: input.unit,
      expires_at: input.expiresAt || null,
    },
    { onConflict: "user_id,ingredient_id" },
  );

  if (error) throw error;
}

export async function updateUserIngredient(
  id: string,
  patch: { amount: number; unit: string; expires_at?: string | null },
): Promise<void> {
  const { error } = await requireSupabase()
    .from("user_ingredients")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteUserIngredient(id: string): Promise<void> {
  const { error } = await requireSupabase().from("user_ingredients").delete().eq("id", id);
  if (error) throw error;
}

export function toRecipeIngredients(
  rows: {
    amount: number;
    unit: string;
    notes: string | null;
    ingredient_id: string;
    ingredients: { name: string; category: string } | { name: string; category: string }[] | null;
  }[],
): RecipeIngredient[] {
  return rows.map((row) => {
    const ingredient = unwrap(row.ingredients);
    return {
      ingredient_id: row.ingredient_id,
      amount: Number(row.amount),
      unit: row.unit,
      notes: row.notes,
      name: ingredient?.name ?? "재료",
      category: ingredient?.category ?? "",
    };
  });
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

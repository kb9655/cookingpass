import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import { normalizeShareCode } from "../lib/shareCode";
import type { AdjustedRecipe, SavedUserRecipe } from "../types/recipe";

type UserRecipeRow = {
  id: string;
  owner_id: string;
  source_recipe_id: string;
  title: string;
  payload: unknown;
  share_code: string | null;
  cloned_from: string | null;
  created_at: string;
};

function isAdjustedRecipe(value: unknown): value is AdjustedRecipe {
  if (!value || typeof value !== "object") return false;
  const recipe = value as AdjustedRecipe;
  return Boolean(
    recipe.title &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.length > 0 &&
      Array.isArray(recipe.steps) &&
      recipe.steps.length > 0,
  );
}

function mapRow(row: UserRecipeRow): SavedUserRecipe | null {
  if (!isAdjustedRecipe(row.payload)) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceRecipeId: row.source_recipe_id,
    title: row.title,
    payload: row.payload,
    shareCode: row.share_code,
    clonedFrom: row.cloned_from,
    createdAt: row.created_at,
  };
}

export async function saveUserRecipe(input: {
  userId: string;
  sourceRecipeId: string;
  recipe: AdjustedRecipe;
}): Promise<SavedUserRecipe> {
  const title = input.recipe.title.trim().slice(0, 200);
  const { data, error } = await requireSupabase()
    .from("user_recipes")
    .insert({
      owner_id: input.userId,
      source_recipe_id: input.sourceRecipeId,
      title,
      payload: input.recipe,
    })
    .select("id, owner_id, source_recipe_id, title, payload, share_code, cloned_from, created_at")
    .single();
  if (error) throw error;
  const mapped = mapRow(data as UserRecipeRow);
  if (!mapped) throw new Error("Saved recipe payload is invalid.");
  return mapped;
}

export async function listUserRecipes(userId: string): Promise<SavedUserRecipe[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await requireSupabase()
    .from("user_recipes")
    .select("id, owner_id, source_recipe_id, title, payload, share_code, cloned_from, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const mapped = mapRow(row as UserRecipeRow);
    return mapped ? [mapped] : [];
  });
}

export async function getUserRecipe(userId: string, id: string): Promise<SavedUserRecipe | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await requireSupabase()
    .from("user_recipes")
    .select("id, owner_id, source_recipe_id, title, payload, share_code, cloned_from, created_at")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as UserRecipeRow);
}

export async function deleteUserRecipe(userId: string, id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("user_recipes")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function ensureShareCode(id: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc("ensure_share_code", { p_id: id });
  if (error) throw new Error(error.message || "Could not create a share code.");
  if (typeof data !== "string" || !data) throw new Error("Could not create a share code.");
  return data;
}

export async function importSharedRecipe(code: string): Promise<string> {
  const normalized = normalizeShareCode(code);
  if (!normalized) {
    const error = new Error("Invalid share code");
    error.name = "InvalidShareCode";
    throw error;
  }
  const { data, error } = await requireSupabase().rpc("import_shared_recipe", { p_code: normalized });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("Share code not found");
  return data;
}

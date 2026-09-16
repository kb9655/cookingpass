import type { Locale } from "../i18n/messages";
import { requireSupabase } from "../lib/supabase";
import type { AdjustedRecipe } from "../types/recipe";
import type { RecipeIngredient } from "../types/ingredient";
import type { CookingHistory } from "../types/user";

type RecipeNameJoin = {
  name?: string;
  difficulty?: number | null;
  recipe_translations?: Array<{ locale: string; name: string }> | null;
} | null;

function pickHistoryName(recipe: RecipeNameJoin, locale: Locale): string {
  const translations = recipe?.recipe_translations ?? [];
  const localized =
    translations.find((row) => row.locale === locale)?.name ??
    translations.find((row) => row.locale === "en")?.name ??
    recipe?.name;
  return localized?.trim() || "레시피";
}

export type PendingCookingSave = {
  recipeId: string;
  ingredients: RecipeIngredient[] | AdjustedRecipe["ingredients"];
  adjustedRecipe: AdjustedRecipe;
  durationSeconds: number;
  techniqueIds: string[];
};

const PENDING_KEY = "cookingpass:pending-cook-save";

export function stashPendingCookingSave(payload: PendingCookingSave): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
}

export function loadPendingCookingSave(): PendingCookingSave | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCookingSave;
    if (!parsed?.recipeId || !parsed?.adjustedRecipe) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCookingSave(): void {
  sessionStorage.removeItem(PENDING_KEY);
}

export async function saveCookingHistory(input: {
  userId: string;
  recipeId: string;
  ingredients: RecipeIngredient[] | AdjustedRecipe["ingredients"];
  adjustedRecipe: AdjustedRecipe;
  completed: boolean;
  durationSeconds: number;
  techniqueIds: string[];
}): Promise<void> {
  const { error } = await requireSupabase().from("cooking_history").insert({
    user_id: input.userId,
    recipe_id: input.recipeId,
    ingredients_used: input.ingredients,
    adjusted_recipe: input.adjustedRecipe,
    completed: input.completed,
    duration_seconds: input.durationSeconds,
    techniques_used: input.techniqueIds,
  });

  if (error) throw error;
}

export async function flushPendingCookingSave(userId: string): Promise<void> {
  const pending = loadPendingCookingSave();
  if (!pending) return;
  await saveCookingHistory({
    userId,
    recipeId: pending.recipeId,
    ingredients: pending.ingredients,
    adjustedRecipe: pending.adjustedRecipe,
    completed: true,
    durationSeconds: pending.durationSeconds,
    techniqueIds: pending.techniqueIds,
  });
  clearPendingCookingSave();
}

export async function sumCompletedCookingStars(userId: string): Promise<number> {
  const { data, error } = await requireSupabase()
    .from("cooking_history")
    .select("completed, recipes(difficulty)")
    .eq("user_id", userId)
    .eq("completed", true);
  if (error) throw error;
  let stars = 0;
  for (const row of data ?? []) {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    const difficulty = Number((recipe as { difficulty?: number } | null)?.difficulty ?? 1);
    stars += Math.max(1, Math.round(Number.isFinite(difficulty) ? difficulty : 1));
  }
  return stars;
}

export async function listCookingHistory(userId: string, locale: Locale = "ko"): Promise<CookingHistory[]> {
  const { data, error } = await requireSupabase()
    .from("cooking_history")
    .select(
      "id, recipe_id, cooked_at, completed, duration_seconds, recipes(name, difficulty, recipe_translations(locale, name))",
    )
    .eq("user_id", userId)
    .order("cooked_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    const joined = recipe as RecipeNameJoin;
    const difficulty = Number(joined?.difficulty ?? 1);
    return {
      id: row.id as string,
      recipe_id: row.recipe_id as string,
      recipe_name: pickHistoryName(joined, locale),
      cooked_at: row.cooked_at as string,
      completed: Boolean(row.completed),
      duration_seconds: (row.duration_seconds as number | null) ?? null,
      difficulty: Math.max(1, Math.round(Number.isFinite(difficulty) ? difficulty : 1)),
    };
  });
}

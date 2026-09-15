import type { Locale } from "../i18n/messages";
import { requireSupabase } from "../lib/supabase";
import type { AdjustedRecipe } from "../types/recipe";
import type { RecipeIngredient } from "../types/ingredient";
import type { CookingHistory } from "../types/user";

type RecipeNameJoin = {
  name?: string;
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

export async function listCookingHistory(userId: string, locale: Locale = "ko"): Promise<CookingHistory[]> {
  const { data, error } = await requireSupabase()
    .from("cooking_history")
    .select("id, recipe_id, cooked_at, completed, duration_seconds, recipes(name, recipe_translations(locale, name))")
    .eq("user_id", userId)
    .order("cooked_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    return {
      id: row.id as string,
      recipe_id: row.recipe_id as string,
      recipe_name: pickHistoryName(recipe as RecipeNameJoin, locale),
      cooked_at: row.cooked_at as string,
      completed: Boolean(row.completed),
      duration_seconds: (row.duration_seconds as number | null) ?? null,
    };
  });
}

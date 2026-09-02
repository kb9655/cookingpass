import { generateRecipe } from "../lib/api";
import type { AdjustedRecipe } from "../types/recipe";

const storageKey = (recipeId: string) => `cook:${recipeId}`;

export async function requestAdjustedRecipe(input: {
  recipeId: string;
  servings: number;
  notes?: string;
}): Promise<AdjustedRecipe> {
  const recipe = await generateRecipe(input);
  sessionStorage.setItem(
    storageKey(input.recipeId),
    JSON.stringify({
      recipe,
      startedAt: Date.now(),
    }),
  );
  return recipe;
}

export function loadCookingSession(recipeId: string): {
  recipe: AdjustedRecipe;
  startedAt: number;
} | null {
  const raw = sessionStorage.getItem(storageKey(recipeId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { recipe: AdjustedRecipe; startedAt: number };
    if (!parsed?.recipe?.steps?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCookingSession(recipeId: string): void {
  sessionStorage.removeItem(storageKey(recipeId));
}

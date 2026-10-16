export const CLEARED_RECIPES_KEY = "cookingpass:cleared-recipes";
export const RECIPE_WORLD_MAX = 5;

export type ClearedRecipeMark = { id: string; difficulty: number };

export function recipeWorld(difficulty: number): number {
  const stars = Math.round(Number.isFinite(difficulty) ? difficulty : 1);
  return Math.min(RECIPE_WORLD_MAX, Math.max(1, stars));
}

export function catalogWorldMax(recipes: Array<{ difficulty: number }>): number {
  let max = 1;
  for (const recipe of recipes) {
    max = Math.max(max, recipeWorld(recipe.difficulty));
  }
  return Math.min(RECIPE_WORLD_MAX, max);
}

export function loadGuestClearedRecipes(): ClearedRecipeMark[] {
  try {
    const raw = localStorage.getItem(CLEARED_RECIPES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as ClearedRecipeMark;
        if (typeof row.id !== "string" || !row.id) return null;
        return { id: row.id, difficulty: recipeWorld(Number(row.difficulty) || 1) };
      })
      .filter((item): item is ClearedRecipeMark => Boolean(item));
  } catch {
    return [];
  }
}

export function saveGuestClearedRecipes(marks: ClearedRecipeMark[]): void {
  try {
    localStorage.setItem(CLEARED_RECIPES_KEY, JSON.stringify(marks));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function recordGuestClearedRecipe(id: string, difficulty: number): ClearedRecipeMark[] {
  const next = loadGuestClearedRecipes().filter((item) => item.id !== id);
  next.push({ id, difficulty: recipeWorld(difficulty) });
  saveGuestClearedRecipes(next);
  return next;
}

export function maxUnlockedWorld(clears: Array<{ difficulty: number }>): number {
  let unlocked = 1;
  for (const clear of clears) {
    const world = recipeWorld(clear.difficulty);
    unlocked = Math.max(unlocked, Math.min(RECIPE_WORLD_MAX, world + 1));
  }
  return unlocked;
}

export function isWorldUnlocked(world: number, clears: Array<{ difficulty: number }>): boolean {
  return recipeWorld(world) <= maxUnlockedWorld(clears);
}

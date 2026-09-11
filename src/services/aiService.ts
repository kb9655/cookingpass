import { generateRecipe, type GenerateRecipeInput } from "../lib/api";
import type { AdjustedRecipe } from "../types/recipe";

export type CookingDraft = {
  recipeId: string;
  recipe: AdjustedRecipe;
  startedAt: number;
  progressIndex: number;
  viewIndex: number;
};

const DRAFT_KEY = "cookingpass:cook-draft";
const legacyKey = (recipeId: string) => `cook:${recipeId}`;

function isDraft(value: unknown): value is CookingDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as CookingDraft;
  return Boolean(draft.recipeId && draft.recipe?.steps?.length);
}

export function saveCookingDraft(draft: CookingDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadCookingDraft(): CookingDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isDraft(parsed)) return null;
    return {
      ...parsed,
      progressIndex: Math.max(0, parsed.progressIndex ?? 0),
      viewIndex: Math.max(0, parsed.viewIndex ?? 0),
    };
  } catch {
    return null;
  }
}

export function clearCookingDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export async function requestAdjustedRecipe(input: GenerateRecipeInput): Promise<AdjustedRecipe> {
  const recipe = await generateRecipe(input);
  const draft: CookingDraft = {
    recipeId: input.recipeId,
    recipe,
    startedAt: Date.now(),
    progressIndex: 0,
    viewIndex: 0,
  };
  saveCookingDraft(draft);
  sessionStorage.removeItem(legacyKey(input.recipeId));
  return recipe;
}

export function loadCookingSession(recipeId: string): CookingDraft | null {
  const draft = loadCookingDraft();
  if (draft?.recipeId === recipeId) return draft;

  const raw = sessionStorage.getItem(legacyKey(recipeId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { recipe: AdjustedRecipe; startedAt: number };
    if (!parsed?.recipe?.steps?.length) return null;
    const migrated: CookingDraft = {
      recipeId,
      recipe: parsed.recipe,
      startedAt: parsed.startedAt,
      progressIndex: 0,
      viewIndex: 0,
    };
    saveCookingDraft(migrated);
    sessionStorage.removeItem(legacyKey(recipeId));
    return migrated;
  } catch {
    return null;
  }
}

export function clearCookingSession(recipeId?: string): void {
  const draft = loadCookingDraft();
  if (!recipeId || draft?.recipeId === recipeId) {
    clearCookingDraft();
  }
  if (recipeId) sessionStorage.removeItem(legacyKey(recipeId));
}

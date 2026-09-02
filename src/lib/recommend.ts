import type { Recipe, ScoredRecipe } from "../types/recipe";
import type { RecipeIngredient } from "../types/ingredient";
import type { ExperienceLevel, RecommendationWeights } from "../types/user";
import type { TechniqueProgress } from "../types/technique";
import type { UserIngredient } from "../types/ingredient";

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  skill_match: 0.35,
  ingredient_coverage: 0.25,
  difficulty_fit: 0.15,
  time_fit: 0.1,
  tool_fit: 0.1,
  relatedness: 0.05,
};

type RecipeForScore = Recipe & {
  ingredients: RecipeIngredient[];
  technique_ids: string[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function skillMatch(
  techniqueIds: string[],
  progress: TechniqueProgress[],
): number {
  if (techniqueIds.length === 0) return 1;
  const cleared = new Set(
    progress.filter((item) => item.status === "cleared").map((item) => item.technique_id),
  );
  const unlocked = new Set(
    progress
      .filter((item) => item.status === "cleared" || item.status === "unlocked")
      .map((item) => item.technique_id),
  );
  const clearedCount = techniqueIds.filter((id) => cleared.has(id)).length;
  const missingRequired = techniqueIds.filter((id) => !unlocked.has(id)).length;
  return clamp01(clearedCount / techniqueIds.length - missingRequired * 0.15);
}

function amountsCompatible(have: number, need: number): boolean {
  if (need <= 0) return true;
  return have + 1e-6 >= need * 0.5;
}

function pantryCoverage(
  ingredients: RecipeIngredient[],
  pantry: UserIngredient[],
): number {
  if (ingredients.length === 0) return 1;
  const byId = new Map(pantry.map((item) => [item.ingredient_id, item]));
  let covered = 0;
  for (const ingredient of ingredients) {
    const owned = byId.get(ingredient.ingredient_id);
    if (!owned) continue;
    const sameUnit = owned.unit === ingredient.unit;
    if (sameUnit && amountsCompatible(owned.amount, ingredient.amount)) {
      covered += 1;
    } else if (owned.amount > 0) {
      covered += 0.5;
    }
  }
  return covered / ingredients.length;
}

function difficultyFit(recipeDifficulty: number, level: ExperienceLevel): number {
  const target = level === "beginner" ? 2 : level === "intermediate" ? 3 : 4;
  const distance = Math.abs(recipeDifficulty - target);
  return clamp01(1 - distance / 4);
}

function timeFit(minutes: number, preferredMax: number | null): number {
  if (!preferredMax) return 0.8;
  if (minutes <= preferredMax) return 1;
  const over = minutes - preferredMax;
  return clamp01(1 - over / preferredMax);
}

function toolFit(required: string[], available: string[]): number {
  if (required.length === 0) return 1;
  if (available.length === 0) return 0.6;
  const owned = new Set(available);
  const matched = required.filter((tool) => owned.has(tool)).length;
  return matched / required.length;
}

function relatedness(techniqueIds: string[], focusTechniqueId: string | null): number {
  if (!focusTechniqueId) return 0.4;
  return techniqueIds.includes(focusTechniqueId) ? 1 : 0;
}

export function scoreRecipe(
  recipe: RecipeForScore,
  input: {
    progress: TechniqueProgress[];
    pantry: UserIngredient[];
    experienceLevel: ExperienceLevel;
    preferredMaxMinutes: number | null;
    availableTools: string[];
    focusTechniqueId: string | null;
    weights: RecommendationWeights;
  },
): ScoredRecipe {
  const parts = {
    skill_match: skillMatch(recipe.technique_ids, input.progress),
    pantry_coverage: pantryCoverage(recipe.ingredients, input.pantry),
    difficulty_fit: difficultyFit(recipe.difficulty, input.experienceLevel),
    time_fit: timeFit(recipe.estimated_minutes, input.preferredMaxMinutes),
    tool_fit: toolFit(recipe.required_tools, input.availableTools),
    relatedness: relatedness(recipe.technique_ids, input.focusTechniqueId),
  };

  const score =
    parts.skill_match * input.weights.skill_match +
    parts.pantry_coverage * input.weights.ingredient_coverage +
    parts.difficulty_fit * input.weights.difficulty_fit +
    parts.time_fit * input.weights.time_fit +
    parts.tool_fit * input.weights.tool_fit +
    parts.relatedness * input.weights.relatedness;

  return {
    ...recipe,
    ...parts,
    score,
  };
}

export function sortByScore(recipes: ScoredRecipe[]): ScoredRecipe[] {
  return [...recipes].sort((a, b) => b.score - a.score);
}

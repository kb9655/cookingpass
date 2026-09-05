import { getLocalRecipeDetail, listLocalRecipes, listParsedRecipes } from "../data/recipeRepository";
import { scoreRecipe, sortByScore, DEFAULT_WEIGHTS } from "../lib/recommend";
import type { Recipe, RecipeDetail, ScoredRecipe } from "../types/recipe";
import type { TechniqueProgress } from "../types/technique";
import type { UserIngredient } from "../types/ingredient";
import type { ExperienceLevel, RecommendationWeights } from "../types/user";

export async function listRecipes(): Promise<Recipe[]> {
  return listLocalRecipes();
}

export async function getRecipeDetail(id: string): Promise<RecipeDetail | null> {
  return getLocalRecipeDetail(id);
}

export async function getRecommendationWeights(): Promise<RecommendationWeights> {
  return { ...DEFAULT_WEIGHTS };
}

export async function listScoredRecipes(input: {
  progress: TechniqueProgress[];
  pantry: UserIngredient[];
  experienceLevel: ExperienceLevel;
  preferredMaxMinutes: number | null;
  availableTools: string[];
  focusTechniqueId: string | null;
  query?: string;
  category?: string;
}): Promise<ScoredRecipe[]> {
  const [records, weights] = await Promise.all([listParsedRecipes(), getRecommendationWeights()]);
  const query = input.query?.trim().toLowerCase() ?? "";
  const category = input.category?.trim() ?? "";

  const filtered = records.filter((record) => {
    const matchesQuery =
      !query ||
      record.recipe.name.toLowerCase().includes(query) ||
      record.recipe.description.toLowerCase().includes(query) ||
      record.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(query));
    const matchesCategory = !category || record.recipe.category === category;
    return matchesQuery && matchesCategory;
  });

  const scored = filtered.map((record) =>
    scoreRecipe(
      {
        ...record.recipe,
        ingredients: record.ingredients,
        technique_ids: record.technique_ids,
      },
      { ...input, weights },
    ),
  );

  return sortByScore(scored);
}

import { requireSupabase } from "../lib/supabase";
import { scoreRecipe, sortByScore, DEFAULT_WEIGHTS } from "../lib/recommend";
import { toRecipeIngredients } from "./ingredientService";
import type { Recipe, RecipeDetail, RecipeStep, ScoredRecipe } from "../types/recipe";
import type { Technique, TechniqueProgress } from "../types/technique";
import type { UserIngredient } from "../types/ingredient";
import type { ExperienceLevel, RecommendationWeights } from "../types/user";

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await requireSupabase()
    .from("recipes")
    .select("id, slug, name, description, difficulty, estimated_minutes, servings, required_tools")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function getRecipeDetail(id: string): Promise<RecipeDetail | null> {
  const supabase = requireSupabase();
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, slug, name, description, difficulty, estimated_minutes, servings, required_tools")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!recipe) return null;

  const [{ data: ingredientRows }, { data: steps }, { data: techniqueRows }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("ingredient_id, amount, unit, notes, ingredients(name, category)")
      .eq("recipe_id", id),
    supabase
      .from("recipe_steps")
      .select("id, recipe_id, step_number, instruction, technique_id")
      .eq("recipe_id", id)
      .order("step_number", { ascending: true }),
    supabase
      .from("recipe_techniques")
      .select(
        "is_primary, techniques(id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number)",
      )
      .eq("recipe_id", id),
  ]);

  const ingredients = toRecipeIngredients(
    (ingredientRows ?? []).map((row) => ({
      ...row,
      notes: row.notes as string | null,
      amount: Number(row.amount),
      unit: row.unit as string,
      ingredient_id: row.ingredient_id as string,
      ingredients: row.ingredients as { name: string; category: string } | { name: string; category: string }[] | null,
    })),
  );

  const techniques = (techniqueRows ?? [])
    .map((row) => {
      const technique = unwrap(row.techniques as Technique | Technique[] | null);
      if (!technique) return null;
      return { ...technique, is_primary: Boolean(row.is_primary) };
    })
    .filter((item): item is Technique & { is_primary: boolean } => Boolean(item));

  return {
    ...(recipe as Recipe),
    ingredients,
    steps: (steps ?? []) as RecipeStep[],
    techniques,
  };
}

export async function getRecommendationWeights(): Promise<RecommendationWeights> {
  const { data, error } = await requireSupabase()
    .from("recommendation_weights")
    .select("key, value");

  if (error) throw error;

  const weights = { ...DEFAULT_WEIGHTS };
  for (const row of data ?? []) {
    const key = row.key as keyof RecommendationWeights;
    if (key in weights) {
      weights[key] = Number(row.value);
    }
  }
  return weights;
}

export async function listScoredRecipes(input: {
  progress: TechniqueProgress[];
  pantry: UserIngredient[];
  experienceLevel: ExperienceLevel;
  preferredMaxMinutes: number | null;
  availableTools: string[];
  focusTechniqueId: string | null;
}): Promise<ScoredRecipe[]> {
  const supabase = requireSupabase();
  const [recipes, weights, ingredientRows, techniqueRows] = await Promise.all([
    listRecipes(),
    getRecommendationWeights(),
    supabase.from("recipe_ingredients").select("recipe_id, ingredient_id, amount, unit, notes, ingredients(name, category)"),
    supabase.from("recipe_techniques").select("recipe_id, technique_id"),
  ]);

  if (ingredientRows.error) throw ingredientRows.error;
  if (techniqueRows.error) throw techniqueRows.error;

  const ingredientsByRecipe = new Map<string, ReturnType<typeof toRecipeIngredients>>();
  for (const recipe of recipes) {
    const rows = (ingredientRows.data ?? []).filter((row) => row.recipe_id === recipe.id);
    ingredientsByRecipe.set(
      recipe.id,
      toRecipeIngredients(
        rows.map((row) => ({
          amount: Number(row.amount),
          unit: row.unit as string,
          notes: row.notes as string | null,
          ingredient_id: row.ingredient_id as string,
          ingredients: row.ingredients as { name: string; category: string } | { name: string; category: string }[] | null,
        })),
      ),
    );
  }

  const techniquesByRecipe = new Map<string, string[]>();
  for (const row of techniqueRows.data ?? []) {
    const list = techniquesByRecipe.get(row.recipe_id as string) ?? [];
    list.push(row.technique_id as string);
    techniquesByRecipe.set(row.recipe_id as string, list);
  }

  const scored = recipes.map((recipe) =>
    scoreRecipe(
      {
        ...recipe,
        ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
        technique_ids: techniquesByRecipe.get(recipe.id) ?? [],
      },
      { ...input, weights },
    ),
  );

  return sortByScore(scored);
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

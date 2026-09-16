import { scoreRecipe, sortByScore, DEFAULT_WEIGHTS } from "../lib/recommend";
import { requireSupabase } from "../lib/supabase";
import type { Locale } from "../i18n/messages";
import type { ParsedRecipeRecord } from "../data/parseRecipeCsv";
import type { Ingredient, RecipeIngredient, UserIngredient } from "../types/ingredient";
import type { Recipe, RecipeDetail, ScoredRecipe } from "../types/recipe";
import type { Technique, TechniqueProgress } from "../types/technique";
import type { ExperienceLevel, RecommendationWeights } from "../types/user";

type Translation = {
  recipe_id: string;
  locale: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
};

type NameTranslation = { locale: string; name: string };

function pickTranslation<T extends { locale: string }>(
  rows: T[] | null | undefined,
  locale: Locale,
): T | undefined {
  return rows?.find((row) => row.locale === locale) ?? rows?.find((row) => row.locale === "en");
}

function pickKorean<T extends { locale: string }>(rows: T[] | null | undefined): T | undefined {
  return rows?.find((row) => row.locale === "ko") ?? rows?.[0];
}

function localizeRecipe(
  row: {
    id: string;
    slug: string;
    name: string;
    description: string;
    difficulty: number;
    estimated_minutes: number;
    servings: number;
    required_tools: string[] | null;
    category: string;
    subcategory: string;
  },
  translation: Translation | undefined,
): Recipe {
  return {
    id: row.id,
    slug: row.slug,
    name: translation?.name ?? row.name,
    description: translation?.description ?? row.description,
    difficulty: row.difficulty,
    estimated_minutes: row.estimated_minutes,
    servings: row.servings,
    required_tools: row.required_tools ?? [],
    category: translation?.category ?? row.category,
    subcategory: translation?.subcategory ?? row.subcategory,
    source_dataset: "supabase",
  };
}

async function loadRecipeTranslations(locale: Locale): Promise<Map<string, Translation>> {
  const { data, error } = await requireSupabase()
    .from("recipe_translations")
    .select("recipe_id, locale, name, description, category, subcategory")
    .in("locale", [locale, "en"]);
  if (error) throw error;
  const map = new Map<string, Translation>();
  for (const row of (data ?? []) as Translation[]) {
    const current = map.get(row.recipe_id);
    if (!current || row.locale === locale) map.set(row.recipe_id, row);
  }
  return map;
}

export async function listRecipes(locale: Locale = "ko"): Promise<Recipe[]> {
  const [{ data, error }, translations] = await Promise.all([
    requireSupabase()
      .from("recipes")
      .select(
        "id, slug, name, description, difficulty, estimated_minutes, servings, required_tools, category, subcategory",
      )
      .order("name"),
    loadRecipeTranslations(locale),
  ]);
  if (error) throw error;
  return (data ?? []).map((row) => localizeRecipe(row, translations.get(row.id)));
}

export async function listKnownTools(): Promise<string[]> {
  const { data, error } = await requireSupabase().from("recipes").select("required_tools");
  if (error) throw error;
  const tools = new Set<string>();
  for (const row of data ?? []) {
    for (const tool of (row.required_tools as string[] | null) ?? []) {
      const name = String(tool).trim();
      if (name) tools.add(name);
    }
  }
  return [...tools].sort((a, b) => a.localeCompare(b, "ko"));
}

export async function listRecipeCategories(locale: Locale = "ko"): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from("recipe_translations")
    .select("category")
    .eq("locale", locale);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function listCatalogIngredients(_locale: Locale = "ko"): Promise<Ingredient[]> {
  const { data, error } = await requireSupabase()
    .from("ingredients")
    .select("id, name, default_unit, category, ingredient_translations(locale, name)")
    .order("name");
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    default_unit: string;
    category: string;
    ingredient_translations: NameTranslation[] | null;
  }>).map((row) => ({
    id: row.id,
    name: pickKorean(row.ingredient_translations)?.name ?? row.name,
    default_unit: row.default_unit,
    category: row.category,
  }));
}

export async function getRecipeDetail(id: string, locale: Locale = "ko"): Promise<RecipeDetail | null> {
  const client = requireSupabase();
  const { data: recipe, error } = await client
    .from("recipes")
    .select(
      "id, slug, name, description, difficulty, estimated_minutes, servings, required_tools, category, subcategory",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!recipe) return null;

  const [translationRes, ingredientRes, stepRes, techniqueRes] = await Promise.all([
    client
      .from("recipe_translations")
      .select("recipe_id, locale, name, description, category, subcategory")
      .eq("recipe_id", id)
      .in("locale", [locale, "en"]),
    client
      .from("recipe_ingredients")
      .select(
        "amount, unit, notes, ingredient_id, ingredients(id, name, category, ingredient_translations(locale, name))",
      )
      .eq("recipe_id", id),
    client
      .from("recipe_steps")
      .select("id, recipe_id, step_number, instruction, technique_id, recipe_step_translations(locale, instruction)")
      .eq("recipe_id", id)
      .order("step_number"),
    client
      .from("recipe_techniques")
      .select("is_primary, techniques(id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number)")
      .eq("recipe_id", id),
  ]);

  if (translationRes.error) throw translationRes.error;
  if (ingredientRes.error) throw ingredientRes.error;
  if (stepRes.error) throw stepRes.error;
  if (techniqueRes.error) throw techniqueRes.error;

  const translation = pickTranslation(translationRes.data as Translation[], locale);
  const ingredients: RecipeIngredient[] = (ingredientRes.data ?? []).map((row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    const names = (ingredient?.ingredient_translations ?? []) as NameTranslation[];
    return {
      ingredient_id: row.ingredient_id,
      name: pickKorean(names)?.name ?? ingredient?.name ?? "",
      amount: Number(row.amount),
      unit: row.unit,
      notes: row.notes,
      category: ingredient?.category ?? "",
    };
  });

  const steps = (stepRes.data ?? []).map((row) => ({
    id: row.id,
    recipe_id: row.recipe_id,
    step_number: row.step_number,
    instruction:
      pickKorean(row.recipe_step_translations as Array<{ locale: string; instruction: string }>)
        ?.instruction ?? row.instruction,
    technique_id: row.technique_id,
  }));

  const techniques = (techniqueRes.data ?? [])
    .map((row) => {
      const technique = Array.isArray(row.techniques) ? row.techniques[0] : row.techniques;
      if (!technique) return null;
      return { ...(technique as Technique), is_primary: row.is_primary };
    })
    .filter((item): item is Technique & { is_primary: boolean } => Boolean(item));

  return {
    ...localizeRecipe(recipe, translation),
    ingredients,
    steps,
    techniques,
  };
}

async function listParsedRecipes(locale: Locale): Promise<ParsedRecipeRecord[]> {
  const recipes = await listRecipes(locale);
  const details = await Promise.all(recipes.map((recipe) => getRecipeDetail(recipe.id, locale)));
  return details
    .filter((item): item is RecipeDetail => Boolean(item))
    .map((detail) => ({
      recipe: {
        id: detail.id,
        slug: detail.slug,
        name: detail.name,
        description: detail.description,
        difficulty: detail.difficulty,
        estimated_minutes: detail.estimated_minutes,
        servings: detail.servings,
        required_tools: detail.required_tools,
        category: detail.category,
        subcategory: detail.subcategory,
        source_dataset: detail.source_dataset,
      },
      ingredients: detail.ingredients,
      steps: detail.steps,
      technique_ids: detail.techniques.map((technique) => technique.id),
    }));
}

export async function getRecommendationWeights(): Promise<RecommendationWeights> {
  return { ...DEFAULT_WEIGHTS };
}

export async function listScoredRecipes(input: {
  locale: Locale;
  progress: TechniqueProgress[];
  pantry: UserIngredient[];
  experienceLevel: ExperienceLevel;
  preferredMaxMinutes: number | null;
  availableTools: string[];
  focusTechniqueId: string | null;
  query?: string;
  category?: string;
}): Promise<ScoredRecipe[]> {
  const [records, weights] = await Promise.all([listParsedRecipes(input.locale), getRecommendationWeights()]);
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

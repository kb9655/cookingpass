import type { Ingredient } from "../types/ingredient";
import type { Recipe, RecipeDetail } from "../types/recipe";
import { RECIPE_DATASETS, type RecipeParserId } from "./datasets";
import { getLocalTechnique } from "./localTechniques";
import {
  ingredientIdFromName,
  parseTitleCategoryJsonArrays,
  type ParsedRecipeRecord,
} from "./parseRecipeCsv";

let cache: ParsedRecipeRecord[] | null = null;
let loading: Promise<ParsedRecipeRecord[]> | null = null;

const parsers: Record<RecipeParserId, typeof parseTitleCategoryJsonArrays> = {
  "title-category-json-arrays": parseTitleCategoryJsonArrays,
};

async function loadDataset(dataset: (typeof RECIPE_DATASETS)[number]): Promise<ParsedRecipeRecord[]> {
  const response = await fetch(dataset.file);
  if (!response.ok) {
    throw new Error(`${dataset.file} 레시피 파일을 불러오지 못했습니다.`);
  }
  const text = await response.text();
  const parse = parsers[dataset.parser];
  return parse(text, dataset.id);
}

export async function loadAllRecipes(): Promise<ParsedRecipeRecord[]> {
  if (cache) return cache;
  if (!loading) {
    loading = Promise.all(RECIPE_DATASETS.map(loadDataset)).then((groups) => {
      cache = groups.flat();
      return cache;
    });
  }
  return loading;
}

export async function listParsedRecipes(): Promise<ParsedRecipeRecord[]> {
  return loadAllRecipes();
}

export async function listLocalRecipes(): Promise<Recipe[]> {
  const records = await loadAllRecipes();
  return records.map((record) => record.recipe);
}

export async function getParsedRecipe(id: string): Promise<ParsedRecipeRecord | null> {
  const records = await loadAllRecipes();
  return records.find((record) => record.recipe.id === id) ?? null;
}

export async function getLocalRecipeDetail(id: string): Promise<RecipeDetail | null> {
  const record = await getParsedRecipe(id);
  if (!record) return null;

  const techniques = record.technique_ids
    .map((techniqueId) => getLocalTechnique(techniqueId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((technique, index) => ({
      ...technique,
      is_primary: index === 0,
    }));

  return {
    ...record.recipe,
    ingredients: record.ingredients,
    steps: record.steps,
    techniques,
  };
}

export async function listCatalogFromRecipes(): Promise<Ingredient[]> {
  const records = await loadAllRecipes();
  const byId = new Map<string, Ingredient>();

  for (const record of records) {
    for (const ingredient of record.ingredients) {
      if (byId.has(ingredient.ingredient_id)) continue;
      byId.set(ingredient.ingredient_id, {
        id: ingredient.ingredient_id,
        name: ingredient.name,
        default_unit: ingredient.unit,
        category: ingredient.category || record.recipe.category,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function customIngredient(name: string, unit = "count"): Ingredient {
  const trimmed = name.trim();
  return {
    id: ingredientIdFromName(trimmed),
    name: trimmed,
    default_unit: unit,
    category: "custom",
  };
}

export function listCategories(records: ParsedRecipeRecord[]): string[] {
  return [...new Set(records.map((record) => record.recipe.category).filter(Boolean))].sort();
}
